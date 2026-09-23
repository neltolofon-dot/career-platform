import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { parseOrThrow, ConflictError, NotFoundError } from './_shared'
import { bookingSchema } from '@/lib/validation/booking'
import { acquireSlotLock, releaseSlotLock, bumpEvents } from '@/lib/redis'
import { getAvailableSlots } from '@/lib/booking/availability'

/**
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  DOUBLE REMPART CONTRE LA DOUBLE RÉSERVATION                         │
 * │                                                                      │
 * │  1. VERROU REDIS — une optimisation. Évite d'atteindre Postgres      │
 * │     dans le cas courant, et rend la réponse immédiate.               │
 * │                                                                      │
 * │  2. INDEX UNIQUE PARTIEL — la GARANTIE. Il ne porte que sur les      │
 * │     rendez-vous PENDING et CONFIRMED : un rendez-vous annulé libère  │
 * │     son créneau. Une erreur P2002 devient un HTTP 409.               │
 * │                                                                      │
 * │  Un invariant métier ne repose JAMAIS sur un cache. Redis peut       │
 * │  redémarrer, perdre une clé, être injoignable — la base, non.        │
 * └──────────────────────────────────────────────────────────────────────┘
 */
export async function bookAppointment(raw: unknown) {
  const data = parseOrThrow(bookingSchema, raw)
  const startsAt = new Date(data.startsAt)
  const iso = startsAt.toISOString()

  // REVALIDATION SERVEUR : le créneau demandé doit figurer dans ceux que
  // le serveur propose réellement. Sans ça, un client forgé réserverait
  // à 3 h du matin un dimanche.
  const availability = await getAvailableSlots(data.serviceSlug, 30)
  if (!availability) throw new NotFoundError()

  const isOffered = availability.days.some((d) =>
    d.slots.some((s) => s.startsAt.getTime() === startsAt.getTime()),
  )
  if (!isOffered) throw new ConflictError("Ce créneau n'est plus disponible.")

  const locked = await acquireSlotLock(iso)
  if (!locked) throw new ConflictError('Ce créneau vient d\'être réservé.')

  try {
    const service = await prisma.service.findFirstOrThrow({
      where: { slug: data.serviceSlug, active: true },
    })

    const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000)

    const appointment = await prisma.$transaction(async (tx) => {
      // Le Contact reste le pivot : la même personne qui a écrit puis
      // réservé n'existe qu'une fois.
      const contact = await tx.contact.upsert({
        where: { email: data.email },
        update: { name: data.name },
        create: { email: data.email, name: data.name, firstSource: 'BOOKING' },
      })

      const created = await tx.appointment.create({
        data: {
          serviceId: service.id,
          contactId: contact.id,
          startsAt,
          endsAt,
          status: 'PENDING',
          guestNote: data.note || null,
        },
      })

      await tx.calendarEvent.create({
        data: {
          kind: 'APPOINTMENT',
          title: `${service.name} — ${contact.name}`,
          startsAt,
          endsAt,
          appointmentId: created.id,
        },
      })

      await tx.notification.create({
        data: {
          type: 'NEW_APPOINTMENT',
          title: `Demande de rendez-vous — ${contact.name}`,
          body: `${service.name}, le ${startsAt.toLocaleString('fr-FR')}`,
          entityType: 'appointment',
          entityId: created.id,
        },
      })

      return created
    })

    await bumpEvents().catch(() => {})

    // Le token d'annulation est opaque : le visiteur annule sans compte,
    // et personne ne peut annuler le rendez-vous d'un autre en devinant
    // un identifiant séquentiel.
    return { id: appointment.id, cancelToken: appointment.cancelToken, startsAt, endsAt }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      // Le verrou Redis a été contourné (expiré, ou instance Redis
      // redémarrée). La contrainte base a fait son travail.
      throw new ConflictError('Ce créneau vient d\'être réservé.')
    }
    throw error
  } finally {
    await releaseSlotLock(iso).catch(() => {})
  }
}

export async function cancelByToken(token: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { cancelToken: token },
    select: { id: true, status: true, startsAt: true },
  })
  if (!appointment) throw new NotFoundError()

  if (appointment.status === 'CANCELLED') return appointment

  await prisma.$transaction([
    prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'CANCELLED' },
    }),
    prisma.calendarEvent.deleteMany({ where: { appointmentId: appointment.id } }),
    prisma.notification.create({
      data: {
        type: 'APPOINTMENT_CANCELLED',
        title: 'Rendez-vous annulé',
        body: appointment.startsAt.toLocaleString('fr-FR'),
        entityType: 'appointment',
        entityId: appointment.id,
      },
    }),
  ])

  await bumpEvents().catch(() => {})
  return appointment
}

export async function setAppointmentStatus(
  id: string,
  status: 'CONFIRMED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED',
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.update({ where: { id }, data: { status } })

    // Un rendez-vous refusé ou annulé disparaît de l'agenda ET libère
    // son créneau, l'index unique partiel ne portant que sur les statuts vivants.
    if (status === 'DECLINED' || status === 'CANCELLED') {
      await tx.calendarEvent.deleteMany({ where: { appointmentId: id } })
    }

    return updated
  })
}

export async function listAppointments() {
  return prisma.appointment.findMany({
    where: { startsAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      guestNote: true,
      service: { select: { name: true } },
      contact: { select: { name: true, email: true } },
    },
    orderBy: { startsAt: 'asc' },
    take: 100,
  })
}

export async function blockDay(date: Date, reason?: string) {
  await prisma.availabilityException.create({
    data: { date, blocked: true, reason: reason ?? null },
  })
}
