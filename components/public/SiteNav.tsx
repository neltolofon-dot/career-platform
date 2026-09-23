import Link from 'next/link'

const SECTIONS = [
  { id: 'travaux', n: '01', label: 'Travaux' },
  { id: 'trajectoire', n: '02', label: 'Parcours' },
  { id: 'terrain', n: '03', label: 'Expertise' },
  { id: 'dialogue', n: '04', label: 'Assistant' },
] as const

export function SiteNav({ name }: { name: string }) {
  const shortName = name.split(' ').slice(1).join(' ') || name

  return (
    <header className="site-nav">
      <Link href="/" className="site-nav__brand" aria-label={name}>
        <span className="site-nav__name">{name}</span>
        <span className="site-nav__name-short" aria-hidden="true">{shortName}</span>
        <span className="site-nav__role">Full-stack · sécurité</span>
      </Link>

      <nav className="site-nav__links" aria-label="Sections principales">
        {SECTIONS.map(({ id, n, label }) => (
          <a key={id} href={`#${id}`} className="site-nav__link">
            <span aria-hidden="true">{n}</span>
            {label}
          </a>
        ))}
      </nav>

      <a href="#contact" className="site-nav__cta">Me contacter</a>
    </header>
  )
}
