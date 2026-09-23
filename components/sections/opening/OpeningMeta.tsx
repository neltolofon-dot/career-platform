import { Mono } from '@/components/primitives/Mono'

/**
 * La ligne de métadonnées vivantes — signature du mouvement 00.
 *
 * Chaque valeur vient de la table Profile et se modifie depuis /admin
 * sans toucher au code, ce qui est exactement l'exigence du sujet.
 */
export function OpeningMeta({
  availability,
  location,
  focusNow,
}: {
  availability: string
  location: string
  focusNow: string | null
}) {
  const items = [availability, location, focusNow ? `Focus : ${focusNow}` : null].filter(
    Boolean,
  ) as string[]

  return (
    <dl
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-2) var(--space-6)',
        margin: 0,
      }}
    >
      {items.map((item, i) => (
        <div key={item} style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {i > 0 && <span className="mono" aria-hidden="true">·</span>}
          <Mono as="dd">{item}</Mono>
        </div>
      ))}
    </dl>
  )
}
