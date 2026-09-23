import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublicProject, getPublicProjects } from '@/lib/services/public'
import { SectionFrame } from '@/components/primitives/SectionFrame'
import { Mono } from '@/components/primitives/Mono'
import { Markdown } from '@/components/public/Markdown'

type Params = { params: Promise<{ slug: string }> }

/**
 * Génération statique des pages projet au build.
 * Le contenu change rarement ; revalidatePath('/') est déjà appelé à
 * chaque écriture admin, donc la fraîcheur est garantie sans rendu
 * à la demande.
 */
export async function generateStaticParams() {
  const projects = await getPublicProjects()
  return projects.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const project = await getPublicProject(slug)
  if (!project) return {}

  return {
    title: `${project.title} — ${project.domain}`,
    description: project.summary,
  }
}

export default async function ProjectPage({ params }: Params) {
  const { slug } = await params
  const project = await getPublicProject(slug)

  if (!project) notFound()

  const links = (project.links ?? {}) as { live?: string; repo?: string }

  return (
    <main>
      <SectionFrame
        number={String(project.year)}
        meta={[project.domain, project.role]}
        anchor="3-10"
      >
        {/* Même view-transition-name que dans l'index : le titre persiste
            physiquement pendant la navigation (primitive M2). */}
        <h1
          className="display display--page"
          style={{ viewTransitionName: `project-${project.slug}` }}
        >
          {project.title}
        </h1>

        <p
          className="prose-body"
          style={{ marginTop: 'var(--space-6)', fontSize: 'var(--text-lg)' }}
        >
          {project.summary}
        </p>

        <hr className="rule" style={{ margin: 'var(--space-8) 0' }} />

        <dl
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-6)',
            margin: '0 0 var(--space-8)',
          }}
        >
          <div>
            <Mono>Stack</Mono>
            <dd style={{ margin: 0 }}>
              <Mono data>{project.stack.join(' · ')}</Mono>
            </dd>
          </div>
          {links.live && (
            <div>
              <Mono>En ligne</Mono>
              <dd style={{ margin: 0 }}>
                <a href={links.live} className="mono mono--data" rel="noopener noreferrer" target="_blank">
                  {new URL(links.live).hostname}
                </a>
              </dd>
            </div>
          )}
          {links.repo && (
            <div>
              <Mono>Code</Mono>
              <dd style={{ margin: 0 }}>
                <a href={links.repo} className="mono mono--data" rel="noopener noreferrer" target="_blank">
                  Dépôt
                </a>
              </dd>
            </div>
          )}
        </dl>

        {project.outcomes.length > 0 && (
          <>
            <Mono>Résultats</Mono>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 'var(--space-3) 0 var(--space-8)',
                maxWidth: 'var(--measure)',
              }}
            >
              {project.outcomes.map((o) => (
                <li
                  key={o}
                  style={{
                    paddingLeft: 'var(--space-4)',
                    borderLeft: '2px solid var(--color-vermilion)',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  {o}
                </li>
              ))}
            </ul>
          </>
        )}

        {project.content && <Markdown>{project.content}</Markdown>}

        <hr className="rule" style={{ margin: 'var(--space-12) 0 var(--space-6)' }} />
        <Link href="/#travaux" className="mono">
          ← Retour à l’index
        </Link>
      </SectionFrame>
    </main>
  )
}
