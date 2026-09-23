import Link from 'next/link'

/**
 * Pas de menu de navigation classique.
 *
 * Une barre fine avec les numéros de section — c'est un document, pas
 * une application. Le nom en mono à gauche, les ancres numérotées à droite.
 * Aucun logo, aucune icône, aucun bouton d'appel à l'action.
 */
const SECTIONS = [
  { id: 'ouverture', n: '00' },
  { id: 'travaux', n: '01' },
  { id: 'trajectoire', n: '02' },
  { id: 'terrain', n: '03' },
  { id: 'dialogue', n: '04' },
  { id: 'contact', n: '05' },
] as const

export function SiteNav({ name }: { name: string }) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'var(--space-3) var(--gutter)',
        borderBottom: 'var(--rule-width) solid var(--color-rule)',
        background: 'var(--color-paper)',
      }}
    >
      <Link href="/" className="mono" style={{ textDecoration: 'none' }}>
        {name}
      </Link>

      <nav aria-label="Sections" style={{ display: 'flex', gap: 'var(--space-4)' }}>
        {SECTIONS.map(({ id, n }) => (
          <a key={id} href={`#${id}`} className="mono" style={{ textDecoration: 'none' }}>
            {n}
          </a>
        ))}
      </nav>
    </header>
  )
}
