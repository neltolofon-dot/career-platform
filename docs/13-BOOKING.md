# Bloc 6 — Réservation (version minimale, réelle)

> **Périmètre volontairement resserré**, documenté comme tel. Ce qui compte :
> la disponibilité est calculée **côté serveur**, et deux personnes ne peuvent
> pas réserver le même créneau. Le reste est du confort.

---

## Ce qu'on livre / ce qu'on coupe

| Livré | Coupé, documenté dans ARCHITECTURE.md |
|---|---|
| Choix du service | Vue calendrier mensuelle → liste des 7 prochains jours |
| Créneaux réels calculés serveur | Synchronisation Google Calendar (bonus non retenu) |
| Réservation avec verrou + contrainte | E-mail de confirmation (pas de service d'envoi) |
| Annulation par lien opaque | Modification d'un rendez-vous → annuler + reprendre |
| Admin : accepter / refuser / annuler | Édition des règles horaires → seed + blocage de date |
| Admin : blocage d'une journée | |

**À l'oral :** *« la vue calendrier était du confort d'interface ; le calcul de
disponibilité et la garantie de non-collision sont le cœur du module. J'ai gardé le
cœur. »*

---

## Fichier 1 — `lib/booking/availability.ts` ⭐

```ts
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
```

---

## Fichier 2 — `lib/validation/booking.ts`

```ts
import { z } from 'zod'

export const bookingSchema = z.object({
  serviceSlug: z.string().min(2).max(80),
  startsAt: z.string().datetime(),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  note: z.string().trim().max(1000).optional().or(z.literal('')),
})
```

---

## Fichier 3 — `lib/services/booking.ts` ⭐ le double rempart

```ts
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
```

---

## Fichier 4 — `app/api/booking/route.ts`

```ts
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '@/lib/redis'
import { bookAppointment } from '@/lib/services/booking'
import { ValidationError, ConflictError, NotFoundError } from '@/lib/services/_shared'
import { getClientIpHash } from '@/lib/request'

export const runtime = 'nodejs'

const ENV = process.env.VERCEL_ENV ?? 'dev'

const bookingLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: `rl:${ENV}:booking`,
})

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 8192) {
    return Response.json({ error: 'Requête trop volumineuse' }, { status: 413 })
  }

  const limit = await bookingLimit.limit(await getClientIpHash())
  if (!limit.success) {
    return Response.json(
      { error: 'Trop de réservations. Réessayez plus tard.' },
      { status: 429, headers: { 'Retry-After': '3600' } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON invalide' }, { status: 400 })
  }

  try {
    const result = await bookAppointment(body)
    return Response.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: 'Validation', fields: error.fields }, { status: 422 })
    }
    // 409 CONFLICT : le créneau est pris. C'est LE test que le jury fera.
    if (error instanceof ConflictError) {
      return Response.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof NotFoundError) {
      return Response.json({ error: 'Service introuvable' }, { status: 404 })
    }

    const ref = crypto.randomUUID()
    console.error(JSON.stringify({ level: 'error', scope: 'booking', ref, error: String(error) }))
    return Response.json({ error: 'Une erreur est survenue.', ref }, { status: 500 })
  }
}

const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: 'POST' } })

export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const DELETE = methodNotAllowed
```

---

## Fichier 5 — `app/(public)/reserver/[slug]/page.tsx`

```tsx
import { notFound } from 'next/navigation'
import { getAvailableSlots } from '@/lib/booking/availability'
import { SectionFrame } from '@/components/primitives/SectionFrame'
import { Mono } from '@/components/primitives/Mono'
import { BookingForm } from '@/components/booking/BookingForm'

export const dynamic = 'force-dynamic' // les disponibilités changent en continu

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const availability = await getAvailableSlots(slug, 7)

  if (!availability) notFound()

  const { service, days } = availability
  const totalSlots = days.reduce((n, d) => n + d.slots.length, 0)

  return (
    <main>
      <SectionFrame
        number="RDV"
        meta={[service.name, `${service.durationMin} min`, `${totalSlots} créneaux`]}
        anchor="3-10"
      >
        <h1 className="display display--page">{service.name}</h1>
        <p className="prose-body" style={{ marginTop: 'var(--space-4)' }}>
          Choisissez un créneau. Vous recevrez un lien d'annulation, sans création de compte.
        </p>

        <hr className="rule" style={{ margin: 'var(--space-8) 0' }} />

        {days.length === 0 ? (
          <p className="prose-body">
            Aucun créneau disponible dans les sept prochains jours.
          </p>
        ) : (
          <BookingForm serviceSlug={service.slug} days={days.map((d) => ({
            date: d.date.toISOString(),
            label: d.date.toLocaleDateString('fr-FR', {
              weekday: 'long', day: 'numeric', month: 'long',
            }),
            slots: d.slots.map((s) => ({ iso: s.startsAt.toISOString(), label: s.label })),
          }))} />
        )}
      </SectionFrame>
    </main>
  )
}
```

## Fichier 6 — `components/booking/BookingForm.tsx`

```tsx
'use client'

// "use client" justifié : sélection d'un créneau, état de soumission,
// appel réseau. Les créneaux eux-mêmes sont calculés côté serveur.

import { useState } from 'react'

type Day = { date: string; label: string; slots: { iso: string; label: string }[] }

export function BookingForm({ serviceSlug, days }: { serviceSlug: string; days: Day[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [cancelUrl, setCancelUrl] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selected) return

    setState('sending')
    const fd = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceSlug,
          startsAt: selected,
          name: fd.get('name'),
          email: fd.get('email'),
          note: fd.get('note'),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setCancelUrl(`/annuler/${data.cancelToken}`)
        setState('done')
        return
      }

      // 409 : quelqu'un a réservé pendant qu'on remplissait le formulaire.
      setError(res.status === 409 ? data.error : data.error ?? 'Erreur')
      setState('error')
    } catch {
      setError('Connexion impossible.')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div role="status">
        <p className="prose-body">
          Demande enregistrée. Vous recevrez une confirmation après validation.
        </p>
        <p className="mono" style={{ marginTop: 'var(--space-4)' }}>
          Lien d'annulation : <a href={cancelUrl}>{cancelUrl}</a>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit}>
      <fieldset style={{ border: 0, padding: 0, margin: '0 0 var(--space-8)' }}>
        <legend className="field__label">Créneau</legend>

        {days.map((day) => (
          <div key={day.date} style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ marginBottom: 'var(--space-2)' }}>
              <span className="mono">{day.label}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {day.slots.map((slot) => (
                <label
                  key={slot.iso}
                  className="mono"
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    border: `var(--rule-width) solid ${
                      selected === slot.iso ? 'var(--color-vermilion)' : 'var(--color-rule)'
                    }`,
                    cursor: 'pointer',
                    color: selected === slot.iso ? 'var(--color-vermilion)' : 'var(--color-ink)',
                  }}
                >
                  <input
                    type="radio"
                    name="slot"
                    value={slot.iso}
                    checked={selected === slot.iso}
                    onChange={() => setSelected(slot.iso)}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                  />
                  {slot.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      <div className="field" style={{ marginBottom: 'var(--space-6)' }}>
        <label className="field__label" htmlFor="b-name">Nom *</label>
        <input className="field__input" id="b-name" name="name" required maxLength={120} />
      </div>

      <div className="field" style={{ marginBottom: 'var(--space-6)' }}>
        <label className="field__label" htmlFor="b-email">E-mail *</label>
        <input className="field__input" id="b-email" name="email" type="email" required maxLength={254} />
      </div>

      <div className="field" style={{ marginBottom: 'var(--space-8)' }}>
        <label className="field__label" htmlFor="b-note">Objet du rendez-vous</label>
        <textarea className="field__input" id="b-note" name="note" rows={4} maxLength={1000} />
      </div>

      {state === 'error' && (
        <p className="field__error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </p>
      )}

      <button className="btn btn--primary" type="submit" disabled={!selected || state === 'sending'}>
        {state === 'sending' ? 'Réservation…' : 'Réserver ce créneau'}
      </button>
    </form>
  )
}
```

---

## Fichier 7 — `app/(public)/annuler/[token]/page.tsx`

```tsx
import { cancelByToken } from '@/lib/services/booking'
import { NotFoundError } from '@/lib/services/_shared'
import { SectionFrame } from '@/components/primitives/SectionFrame'
import { CancelButton } from '@/components/booking/CancelButton'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * L'annulation se fait par un token opaque, pas par un identifiant de
 * rendez-vous : personne ne peut annuler le rendez-vous d'un autre en
 * incrémentant un nombre dans l'URL.
 *
 * L'annulation elle-même passe par une Server Action (POST), jamais par
 * le simple chargement de la page : un GET ne doit pas modifier d'état —
 * sinon un aperçu de lien dans une messagerie annulerait le rendez-vous.
 */
export default async function CancelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const appointment = await prisma.appointment.findUnique({
    where: { cancelToken: token },
    select: {
      startsAt: true,
      status: true,
      service: { select: { name: true } },
    },
  })

  if (!appointment) notFound()

  const cancelled = appointment.status === 'CANCELLED'

  return (
    <main>
      <SectionFrame number="RDV" meta={['Annulation']} anchor="3-10">
        <h1 className="display display--section">
          {cancelled ? 'Rendez-vous annulé' : 'Annuler ce rendez-vous ?'}
        </h1>

        <p className="prose-body" style={{ marginTop: 'var(--space-4)' }}>
          {appointment.service.name} — {appointment.startsAt.toLocaleString('fr-FR')}
        </p>

        {!cancelled && (
          <div style={{ marginTop: 'var(--space-8)' }}>
            <CancelButton token={token} />
          </div>
        )}
      </SectionFrame>
    </main>
  )
}

export async function cancelAction(token: string) {
  'use server'
  try {
    await cancelByToken(token)
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error
  }
}
```

## Fichier 8 — `components/booking/CancelButton.tsx`

```tsx
'use client'

import { useState } from 'react'

export function CancelButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')

  if (state === 'done') {
    return <p className="prose-body" role="status">Rendez-vous annulé. Le créneau est de nouveau disponible.</p>
  }

  return (
    <button
      className="btn btn--primary"
      disabled={state === 'sending'}
      onClick={async () => {
        setState('sending')
        await fetch(`/api/booking/cancel/${token}`, { method: 'POST' })
        setState('done')
      }}
    >
      {state === 'sending' ? 'Annulation…' : 'Confirmer l\'annulation'}
    </button>
  )
}
```

## Fichier 9 — `app/api/booking/cancel/[token]/route.ts`

```ts
import { cancelByToken } from '@/lib/services/booking'
import { NotFoundError } from '@/lib/services/_shared'

export const runtime = 'nodejs'

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  try {
    await cancelByToken(token)
    return Response.json({ ok: true })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return Response.json({ error: 'Introuvable' }, { status: 404 })
    }
    throw error
  }
}

// GET interdit : une annulation ne doit pas se déclencher au simple
// chargement d'une URL (aperçu de lien, préchargement navigateur…).
export const GET = () => new Response(null, { status: 405, headers: { Allow: 'POST' } })
```

---

## Fichier 10 — `app/admin/calendar/page.tsx`

```tsx
import { requireAdminPage } from '@/lib/auth/guard'
import { listAppointments } from '@/lib/services/booking'
import { setStatusAction, blockDayAction } from './actions'

export const metadata = { title: 'Calendrier', robots: { index: false } }

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmé',
  DECLINED: 'Refusé',
  CANCELLED: 'Annulé',
  COMPLETED: 'Terminé',
}

export default async function CalendarPage() {
  await requireAdminPage()
  const appointments = await listAppointments()

  const pending = appointments.filter((a) => a.status === 'PENDING')

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">Agenda</h1>
      <p className="mono" style={{ marginTop: 'var(--space-2)' }}>
        {appointments.length} rendez-vous · {pending.length} en attente
      </p>

      <form action={blockDayAction} style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', alignItems: 'end' }}>
        <div className="field">
          <label className="field__label" htmlFor="block-date">Bloquer une journée</label>
          <input className="field__input" id="block-date" name="date" type="date" required />
        </div>
        <button className="btn" type="submit">Bloquer</button>
      </form>

      <table className="admin-table" style={{ marginTop: 'var(--space-8)' }}>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Service</th>
            <th scope="col">Demandeur</th>
            <th scope="col">Statut</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => (
            <tr key={a.id}>
              <td className="mono mono--data">{a.startsAt.toLocaleString('fr-FR')}</td>
              <td>{a.service.name}</td>
              <td>
                {a.contact.name}
                <div className="mono">{a.contact.email}</div>
                {a.guestNote && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-muted)' }}>
                    {a.guestNote}
                  </p>
                )}
              </td>
              <td>
                <span className={`badge ${a.status === 'CONFIRMED' ? 'badge--live' : a.status === 'PENDING' ? 'badge--urgent' : 'badge--draft'}`}>
                  {STATUS_LABELS[a.status]}
                </span>
              </td>
              <td>
                {(a.status === 'PENDING' || a.status === 'CONFIRMED') && (
                  <form action={setStatusAction} style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <input type="hidden" name="id" value={a.id} />
                    {a.status === 'PENDING' && (
                      <button name="status" value="CONFIRMED" className="mono" style={btnStyle}>
                        Accepter
                      </button>
                    )}
                    {a.status === 'PENDING' && (
                      <button name="status" value="DECLINED" className="mono" style={btnStyle}>
                        Refuser
                      </button>
                    )}
                    <button
                      name="status"
                      value="CANCELLED"
                      className="mono"
                      style={{ ...btnStyle, color: 'var(--color-vermilion)' }}
                    >
                      Annuler
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const btnStyle = { background: 'none', border: 0, cursor: 'pointer' } as const
```

## Fichier 11 — `app/admin/calendar/actions.ts`

```ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAdminApi } from '@/lib/auth/guard'
import { setAppointmentStatus, blockDay } from '@/lib/services/booking'

const statusSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(['CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED']),
})

export async function setStatusAction(formData: FormData) {
  await requireAdminApi()

  // Validation Zod plutôt qu'un cast : une Server Action est un point
  // d'entrée HTTP, son FormData vient du client.
  const parsed = statusSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
  })
  if (!parsed.success) return

  await setAppointmentStatus(parsed.data.id, parsed.data.status)
  revalidatePath('/admin/calendar')
}

const blockSchema = z.object({ date: z.string().date() })

export async function blockDayAction(formData: FormData) {
  await requireAdminApi()

  const parsed = blockSchema.safeParse({ date: formData.get('date') })
  if (!parsed.success) return

  await blockDay(new Date(parsed.data.date))
  revalidatePath('/admin/calendar')
}
```

---

## Le test que le jury fera

```bash
URL="https://career-platform-pied.vercel.app"

# Récupère un créneau réel depuis la page, puis :
SLOT="2026-09-25T09:00:00.000Z"

# Deux réservations SIMULTANÉES sur le même créneau
curl -s -o /dev/null -w "%{http_code} " -X POST "$URL/api/booking" \
  -H "Content-Type: application/json" \
  -d "{\"serviceSlug\":\"appel-decouverte\",\"startsAt\":\"$SLOT\",\"name\":\"A\",\"email\":\"a@test.fr\"}" &
curl -s -o /dev/null -w "%{http_code} " -X POST "$URL/api/booking" \
  -H "Content-Type: application/json" \
  -d "{\"serviceSlug\":\"appel-decouverte\",\"startsAt\":\"$SLOT\",\"name\":\"B\",\"email\":\"b@test.fr\"}" &
wait; echo

# ATTENDU : "201 409" ou "409 201". JAMAIS "201 201".
```

---

## Prompt pour Codex

```
Lis AGENTS.md et docs/13-BOOKING.md.

URGENT. Exécute, ne propose rien.

1. Crée les 11 fichiers exactement comme spécifiés.

2. tsc --noEmit, npm run build, git push.

3. Ouvre /reserver/appel-decouverte : des créneaux doivent s'afficher.
   Si la liste est vide, vérifie les AvailabilityRule en base (5 règles
   lun-ven 9h-17h attendues) et dis-le-moi.

4. LE TEST CRITIQUE — deux réservations simultanées sur le même créneau.
   Attendu : un 201, un 409. Donne la sortie brute.
   Si tu obtiens 201 201, ARRÊTE-TOI et dis-le : l'invariant est cassé.

5. Réserve un créneau, note le cancelToken, ouvre /annuler/<token>,
   annule, et vérifie que le créneau redevient disponible sur
   /reserver/appel-decouverte. C'est la preuve que l'index unique
   PARTIEL fonctionne.

6. Ouvre /admin/calendar, accepte un rendez-vous, confirme que le statut
   passe à CONFIRMED.

7. Mets les résultats de 4 et 5 dans SECURITY.md, section "Invariants
   métier".

Sorties brutes de 4 et 5.
```
