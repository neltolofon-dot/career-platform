import type { ReactNode } from 'react'

/**
 * Tout chiffre, date, label ou identifiant passe par ici.
 * Source de vérité typographique unique : si la police mono change,
 * un seul fichier bouge.
 */
export function Mono({
  children,
  data = false,
  as: Tag = 'span',
}: {
  children: ReactNode
  /** true = donnée lisible (13px, casse conservée) ; false = label (11px, majuscules) */
  data?: boolean
  as?: 'span' | 'div' | 'p' | 'dd' | 'dt'
}) {
  return <Tag className={data ? 'mono mono--data' : 'mono'}>{children}</Tag>
}
