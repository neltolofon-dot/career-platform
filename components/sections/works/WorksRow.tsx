import Link from 'next/link'

type Project = {
  slug: string
  title: string
  domain: string
  role: string
  year: number
  stack: string[]
  summary: string
  live: string | null
}

export function WorksRow({ project }: { project: Project }) {
  return (
    <tr className="index-row">
      <td className="index-row__year" data-label="Année">{project.year}</td>

      <td className="index-row__project">
        <Link
          href={`/travaux/${project.slug}`}
          className="index-row__title"
          style={{ viewTransitionName: `project-${project.slug}` }}
        >
          {project.title}
        </Link>
        <p className="prose-body index-row__summary">{project.summary}</p>
        {project.live && (
          <a href={project.live} className="mono index-row__live" target="_blank" rel="noopener noreferrer">
            Voir le site<span className="sr-only"> {project.title} (nouvel onglet)</span>
            <span aria-hidden="true">&nbsp;↗</span>
          </a>
        )}
      </td>

      <td className="index-row__stack" data-label="Domaine">{project.domain}</td>
      <td className="index-row__stack" data-label="Rôle">{project.role}</td>
      <td className="index-row__stack" data-label="Stack">{project.stack.join(' · ')}</td>
    </tr>
  )
}
