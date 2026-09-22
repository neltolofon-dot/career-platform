import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth/guard'
import { getProjectForAdmin, NotFoundError } from '@/lib/services/projects'
import { ProjectForm } from '@/components/admin/ProjectForm'
import { updateProjectAction } from '../actions'

export const metadata = { title: 'Modifier un projet', robots: { index: false } }

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminPage()
  const { id } = await params

  let project
  try {
    project = await getProjectForAdmin(id)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  // bind : l'id est fixé côté serveur, jamais transmis par le formulaire —
  // sinon un utilisateur pourrait modifier le champ caché et écrire ailleurs.
  const action = updateProjectAction.bind(null, id)

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">{project.title}</h1>
      <hr className="rule" style={{ margin: 'var(--space-6) 0' }} />
      <ProjectForm
        action={action}
        submitLabel="Enregistrer"
        project={{
          ...project,
          links: project.links as { live?: string; repo?: string },
        }}
      />
    </div>
  )
}
