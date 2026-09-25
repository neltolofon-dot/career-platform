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

        {/* width/height = dimensions du FICHIER : avec l'aspect-ratio de
            .portrait, ils gardent le CLS à zéro. `preload` et non `priority`,
            déprécié depuis Next.js 16 ; c'est lui qui porte le LCP. */}
        <figure className="portrait">
          <Image
            className="portrait__img"
            src="/portrait.webp"
            alt="Suhrago Nelkaël Tolofon"
            width={1046}
            height={1100}
            preload
            sizes="(min-width: 1024px) 460px, 90vw"
          />
        </figure>
      </div>

      <OpeningMeta availability={availability} location={location} focusNow={focusNow} />
    </SectionFrame>
  )
}
