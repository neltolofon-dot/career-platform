import { prisma } from '@/lib/prisma'

/**
 * Calcul des créneaux disponibles, ENTIÈREMENT CÔTÉ SERVEUR.
 *
 * Le client n'a aucun rôle dans cette décision : il affiche ce que le
 * serveur lui donne, et le serveur revalide à l'écriture. Un client qui
 * proposerait un créneau que le serveur n'a pas validé serait une faille
 * de logique métier — on pourrait réserver hors horaires en forgeant la
 * requête.
 *
 * Trois sources croisées :
 *   règles récurrentes  −  exceptions  −  rendez-vous existants
 *
 * Les heures des règles sont en MINUTES DEPUIS MINUIT (entier). Une règle
 * récurrente n'a pas de date : un entier élimine tous les pièges de
 * fuseau horaire et d'heure d'été sur une valeur qui n'est pas un instant.
 */

const TZ_OFFSET_MINUTES = 60 // Africa/Lagos, UTC+1, sans heure d'été

export type Slot = { startsAt: Date; endsAt: Date; label: string }

/** Construit un instant UTC à partir d'une date locale et de minutes depuis minuit. */
function localDayMinutesToUtc(day: Date, minutes: number): Date {
  const d = new Date(day)
  d.setUTCHours(0, 0, 0, 0)
  return new Date(d.getTime() + (minutes - TZ_OFFSET_MINUTES) * 60_000)
}

export async function getAvailableSlots(
  serviceSlug: string,
  daysAhead = 7,
): Promise<{ service: { slug: string; name: string; durationMin: number }; days: { date: Date; slots: Slot[] }[] } | null> {
  const service = await prisma.service.findFirst({
    where: { slug: serviceSlug, active: true },
    select: { id: true, slug: true, name: true, durationMin: true, bufferMin: true },
  })
  if (!service) return null

  const now = new Date()
  const horizon = new Date(now.getTime() + daysAhead * 86_400_000)

  const [rules, exceptions, appointments] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { active: true } }),
    prisma.availabilityException.findMany({
      where: { date: { gte: new Date(now.toDateString()), lte: horizon } },
    }),
    // Seuls les rendez-vous VIVANTS occupent un créneau.
    // Un rendez-vous annulé libère sa place — c'est le même raisonnement
    // que l'index unique partiel en base.
    prisma.appointment.findMany({
      where: {
        startsAt: { gte: now, lte: horizon },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: { startsAt: true, endsAt: true },
    }),
  ])

  const days: { date: Date; slots: Slot[] }[] = []
  const step = service.durationMin + service.bufferMin

  for (let i = 1; i <= daysAhead; i++) {
    const day = new Date(now.getTime() + i * 86_400_000)
    day.setUTCHours(0, 0, 0, 0)

    const weekday = day.getUTCDay()
    const dayRules = rules.filter((r) => r.weekday === weekday)
    if (dayRules.length === 0) continue

    // Exception journée entière : la journée saute.
    const dayKey = day.toISOString().slice(0, 10)
    const dayExceptions = exceptions.filter(
      (e) => e.date.toISOString().slice(0, 10) === dayKey,
    )
    if (dayExceptions.some((e) => e.blocked && e.startMinute === null)) continue

    const slots: Slot[] = []

    for (const rule of dayRules) {
      for (let m = rule.startMinute; m + service.durationMin <= rule.endMinute; m += step) {
        const startsAt = localDayMinutesToUtc(day, m)
        const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000)

        if (startsAt <= now) continue

        // Exception de plage
        const blockedByException = dayExceptions.some(
          (e) =>
            e.blocked &&
            e.startMinute !== null &&
            e.endMinute !== null &&
            m < e.endMinute &&
            m + service.durationMin > e.startMinute,
        )
        if (blockedByException) continue

        // Chevauchement avec un rendez-vous existant
        const taken = appointments.some(
          (a) => startsAt < a.endsAt && endsAt > a.startsAt,
        )
        if (taken) continue

        slots.push({
          startsAt,
          endsAt,
          label: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
        })
      }
    }

    if (slots.length) days.push({ date: day, slots })
  }

  return { service: { slug: service.slug, name: service.name, durationMin: service.durationMin }, days }
}
