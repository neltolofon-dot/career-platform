import { SectionFrame } from '@/components/primitives/SectionFrame'
import { ContactForm } from './ContactForm'
import { Mono } from '@/components/primitives/Mono'

/**
 * Mouvement 05 — CONTACT.
 *
 * Deux voies séparées par un filet vertical : écrire, ou réserver un
 * créneau. Pas de carte, pas de boîte — juste deux colonnes et un trait.
 */
export function Contact({
  email,
  availability,
  services,
}: {
  email: string
  availability: string
  services: { slug: string; name: string; durationMin: number }[]
}) {
  return (
    <SectionFrame id="contact" number="05" meta={['Contact', availability]} anchor="5-12" className="enter">
      <h2 className="display display--section">Travaillons ensemble</h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))',
          gap: 'var(--space-12)',
          marginTop: 'var(--space-8)',
        }}
      >
        <div>
          <Mono>Écrire</Mono>
          <hr className="rule" style={{ margin: 'var(--space-3) 0 var(--space-6)' }} />
          <ContactForm />
        </div>

        <div style={{ borderLeft: 'var(--rule-width) solid var(--color-rule)', paddingLeft: 'var(--space-8)' }}>
          <Mono>Réserver un créneau</Mono>
          <hr className="rule" style={{ margin: 'var(--space-3) 0 var(--space-6)' }} />

          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {services.map((s) => (
              <li key={s.slug} style={{ marginBottom: 'var(--space-4)' }}>
                <a href={`/reserver/${s.slug}`} style={{ fontSize: 'var(--text-lg)' }}>
                  {s.name}
                </a>
                <div><Mono>{s.durationMin} minutes</Mono></div>
              </li>
            ))}
          </ul>

          <p className="mono" style={{ marginTop: 'var(--space-8)' }}>
            Ou directement : <a href={`mailto:${email}`}>{email}</a>
          </p>
        </div>
      </div>
    </SectionFrame>
  )
}
