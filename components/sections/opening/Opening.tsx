import Image from 'next/image'
import { SectionFrame } from '@/components/primitives/SectionFrame'
import { RevealLines } from '@/components/primitives/RevealLines'
import { OpeningMeta } from './OpeningMeta'

type OpeningProps = {
  headline: string
  availability: string
  location: string
  focusNow: string | null
  projectCount: number
}

export function Opening({
  headline,
  availability,
  location,
  focusNow,
  projectCount,
}: OpeningProps) {
  // Vérifiable par le jury : les 6 projets ne sont pas tous des commandes
  // clients (MyDayPlanner, THM Roadmap, HashVault sont personnels).
  const introduction = `Développeur full-stack freelance depuis 2023 : ${projectCount} applications web livrées en production, pour des clients béninois et en projets personnels.`

  return (
    <SectionFrame
      id="ouverture"
      number="00"
      meta={['Ouverture', `${projectCount} projets`]}
      anchor="1-11"
      className="enter"
    >
      <div className="opening">
        <div className="opening__copy">
          <p className="opening__eyebrow mono">Full-stack · sécurité applicative</p>

          <h1 className="display display--statement opening__title">
            <RevealLines text={headline} />
          </h1>

          <p className="opening__intro">{introduction}</p>

          <div className="opening__actions" aria-label="Actions principales">
            <a className="btn btn--primary" href="#travaux">
              Voir mes projets <span aria-hidden="true">↓</span>
            </a>
            <a className="btn" href="#contact">Me contacter</a>
          </div>
        </div>

        <figure className="opening__portrait">
          <Image
            src="/images/portrait.webp"
            alt="Suhrago Nelkaël Tolofon"
            width={800}
            height={1067}
            preload
            sizes="(min-width: 64rem) 22rem, 72vw"
          />
          <figcaption className="opening__portrait-caption mono">Cotonou · Bénin</figcaption>
        </figure>
      </div>

      <OpeningMeta availability={availability} location={location} focusNow={focusNow} />
    </SectionFrame>
  )
}
