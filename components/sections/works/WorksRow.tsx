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

/**
 * Une ligne de l'index.
 *
 * Le lien enveloppe le TITRE et non la ligne entière : un <a> autour d'un
 * <tr> est invalide en HTML, et un gestionnaire de clic sur la ligne
 * casserait la navigation clavier, le clic milieu et l'ouverture dans un
 * nouvel onglet. Le survol de la ligne est purement CSS (.index-row:hover).
 *
 * view-transition-name prépare la persistance du titre entre l'index et
 * la page projet (primitive M2).
 */
export function WorksRow({ project }: { project: Project }) {
  return (
    <tr className="index-row">
      <td className="index-row__year">{project.year}</td>

      <td>
        <Link
          href={`/travaux/${project.slug}`}
          className="index-row__title"
          style={{
            textDecoration: 'none',
            viewTransitionName: `project-${project.slug}`,
          }}
        >
          {project.title}
        </Link>
        <p
          className="prose-body"
          style={{
            marginTop: 'var(--space-2)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-ink-muted)',
          }}
        >
          {project.summary}
        </p>
      </td>

      <td className="index-row__stack">{project.domain}</td>
      <td className="index-row__stack">{project.role}</td>
      <td className="index-row__stack">{project.stack.join(' · ')}</td>
    </tr>
  )
}
