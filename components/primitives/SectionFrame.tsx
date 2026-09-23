import type { ReactNode } from 'react'

/**
 * La grille signature : colonne de métadonnées en marge + contenu ancré
 * asymétriquement dans une grille de 12 colonnes.
 *
 * Pourquoi un composant et pas des classes ad hoc par section : c'est ce
 * qui garantit que six sections écrites à six moments différents partagent
 * exactement la même structure. Sans lui, chaque section réinvente sa mise
 * en page et l'identité visuelle se dissout.
 *
 * Les valeurs d'ancrage sont volontairement arbitraires et différentes
 * d'une section à l'autre : une composition doit donner l'impression
 * d'avoir été décidée, pas d'être un conteneur centré répété six fois.
 */

export type Anchor = '1-11' | '1-12' | '3-10' | '4-12' | '2-9' | '5-12'

type SectionFrameProps = {
  /** Numéro à deux chiffres affiché en marge : "00", "01"… */
  number: string
  /** Métadonnées secondaires en marge (années, décomptes, statut) */
  meta?: string[]
  anchor: Anchor
  children: ReactNode
  /** id d'ancrage pour la navigation */
  id?: string
  className?: string
}

export function SectionFrame({
  number,
  meta = [],
  anchor,
  children,
  id,
  className = '',
}: SectionFrameProps) {
  return (
    <section id={id} data-anchor={anchor} className="section">
      {/* La colonne de métadonnées reste toujours --ink-muted et pleinement
          visible (docs/03-DESIGN-SYSTEM.md §4) : .enter ne s'applique
          qu'au corps, jamais à cette colonne sticky. */}
      <div className="section__meta">
        <span className="mono" aria-hidden="true">
          {number}
        </span>
        {meta.map((line) => (
          <span className="mono" key={line}>
            {line}
          </span>
        ))}
      </div>

      <div className={`section__body ${className}`.trim()}>{children}</div>
    </section>
  )
}
