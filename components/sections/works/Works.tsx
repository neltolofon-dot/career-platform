import Link from 'next/link'
import { SectionFrame } from '@/components/primitives/SectionFrame'
import { FeaturedProject } from './FeaturedProject'
import { WorksRow } from './WorksRow'

type Project = {
  slug: string
  title: string
  domain: string
  role: string
  year: number
  stack: string[]
  summary: string
  featured: boolean
}

export function Works({
  projects,
  domains,
  activeDomain,
}: {
  projects: Project[]
  domains: { name: string; count: number }[]
  activeDomain: string | null
}) {
  const n = projects.length
  const showcase = projects.slice(0, 3)

  return (
    <SectionFrame
      id="travaux"
      number="01"
      meta={['Travaux', ...(activeDomain ? [activeDomain] : []), `${n} ${n > 1 ? 'entrées' : 'entrée'}`]}
      anchor="1-12"
      className="enter"
    >
      <div className="section-heading">
        <div>
          <p className="section-kicker mono">Sélection récente</p>
          <h2 className="display display--section">Des produits réels, pas des exercices.</h2>
        </div>
        <p className="section-heading__intro">
          Commerce, productivité et sécurité : chaque projet répond à un usage concret,
          avec une architecture documentée et un résultat visible.
        </p>
      </div>

      {showcase.length > 0 && (
        <div className="works-showcase">
          {showcase.map((project, index) => (
            <FeaturedProject key={project.slug} project={project} index={index} />
          ))}
        </div>
      )}

      <div className="works-index-heading">
        <div>
          <p className="section-kicker mono">Index complet</p>
          <h3 className="display">Tous les travaux</h3>
        </div>
        <span className="mono">{n} {n > 1 ? 'entrées' : 'entrée'}</span>
      </div>

      <nav className="works-filters" aria-label="Filtrer les travaux par domaine">
        <Link
          href="/#travaux"
          prefetch={false}
          className="chat-suggestion"
          aria-current={activeDomain ? undefined : 'true'}
        >
          Tous
        </Link>
        {domains.map((domain) => (
          <Link
            key={domain.name}
            href={`/?domaine=${encodeURIComponent(domain.name)}#travaux`}
            prefetch={false}
            className="chat-suggestion"
            aria-current={activeDomain === domain.name ? 'true' : undefined}
          >
            {domain.name}
          </Link>
        ))}
      </nav>

      <table className="index-table">
        <caption className="sr-only">
          Index des projets : année, titre, domaine, rôle et technologies
        </caption>
        <thead>
          <tr>
            <th scope="col">Année</th>
            <th scope="col">Projet</th>
            <th scope="col">Domaine</th>
            <th scope="col">Rôle</th>
            <th scope="col">Stack</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <WorksRow key={project.slug} project={project} />
          ))}
        </tbody>
      </table>
    </SectionFrame>
  )
}
