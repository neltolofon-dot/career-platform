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

/**
 * Mouvement 00 — OUVERTURE.
 *
 * Une déclaration typographique, le portrait, un filet, une ligne de
 * métadonnées VIVANTES lues en base.
 *
 * Pas de « Hello I'm », pas de bouton « Télécharger mon CV ». Le fond vert
 * du portrait reprend l'accent du site : c'est le lien entre l'identité
 * visuelle et la personne. Les métadonnées sont la première preuve que le
 * site est branché sur une base de données et pilotable depuis /admin.
 */
export function Opening({
  headline,
  availability,
  location,
  focusNow,
  projectCount,
}: OpeningProps) {
  return (
    <SectionFrame
      id="ouverture"
      number="00"
      meta={['Ouverture', `${projectCount} projets`]}
      anchor="1-11"
      className="enter"
    >
      <div className="opening">
        {/* width/height fixes : l'espace est réservé avant le chargement,
            aucun décalage de mise en page. preload remplace `priority`,
            déprécié en Next 16 : l'image est au-dessus de la ligne de flottaison. */}
        <div className="opening__portrait">
          <Image
            src="/images/portrait.webp"
            alt="Suhrago Nelkaël Tolofon"
            width={800}
            height={1067}
            preload
            sizes="(min-width: 64rem) 18rem, 180px"
          />
        </div>

        <h1 className="display display--statement opening__title">
          <RevealLines text={headline} />
        </h1>
      </div>

      <hr className="rule" style={{ margin: 'var(--space-12) 0 var(--space-6)' }} />

      <OpeningMeta availability={availability} location={location} focusNow={focusNow} />
    </SectionFrame>
  )
}
