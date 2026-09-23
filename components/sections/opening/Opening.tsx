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
 * Une déclaration typographique, un filet, une ligne de métadonnées
 * VIVANTES lues en base.
 *
 * Pas de photo, pas de « Hello I'm », pas de bouton « Télécharger mon CV ».
 * Les métadonnées sont la première preuve que le site est branché sur une
 * base de données et pilotable depuis /admin.
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
      <h1 className="display display--statement">
        <RevealLines text={headline} />
      </h1>

      <hr className="rule" style={{ margin: 'var(--space-12) 0 var(--space-6)' }} />

      <OpeningMeta availability={availability} location={location} focusNow={focusNow} />
    </SectionFrame>
  )
}
