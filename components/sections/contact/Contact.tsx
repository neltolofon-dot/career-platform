import { SectionFrame } from '@/components/primitives/SectionFrame'
import { ContactForm } from './ContactForm'
import { Mono } from '@/components/primitives/Mono'

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
      <p className="section-kicker mono">Un projet, une mission, une alternance</p>
      <h2 className="display contact-heading">Parlons de ce que nous pouvons construire.</h2>

      <div className="contact-grid">
        <div className="contact-grid__form">
          <Mono>Écrire</Mono>
          <hr className="rule" />
          <ContactForm />
        </div>

        <div className="contact-grid__booking">
          <Mono>Réserver un créneau</Mono>
          <hr className="rule" />

          <ul className="contact-services">
            {services.map((service) => (
              <li key={service.slug}>
                <a href={`/reserver/${service.slug}`}>{service.name}</a>
                <Mono>{service.durationMin} minutes</Mono>
              </li>
            ))}
          </ul>

          <p className="contact-email mono">
            Ou directement : <a href={`mailto:${email}`}>{email}</a>
          </p>
        </div>
      </div>
    </SectionFrame>
  )
}
