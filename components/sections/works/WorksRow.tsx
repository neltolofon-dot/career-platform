import Link from 'next/link'

type Project = {
  slug: string
  title: string
  domain: string
  role: string
  year: number
  stack: string[]
  summary: string
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
      </td>

      <td className="index-row__stack" data-label="Domaine">{project.domain}</td>
      <td className="index-row__stack" data-label="Rôle">{project.role}</td>
      <td className="index-row__stack" data-label="Stack">{project.stack.join(' · ')}</td>
    </tr>
  )
}
