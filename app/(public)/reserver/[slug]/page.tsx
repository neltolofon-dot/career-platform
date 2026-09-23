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
          Choisissez un créneau. Vous recevrez un lien d’annulation, sans création de compte.
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
