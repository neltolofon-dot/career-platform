import { requireAdminPage } from '@/lib/auth/guard'
import { ProjectForm } from '@/components/admin/ProjectForm'
import { createProjectAction } from '../actions'

export const metadata = { title: 'Nouveau projet', robots: { index: false } }

export default async function NewProjectPage() {
  await requireAdminPage()

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">Nouveau projet</h1>
      <hr className="rule" style={{ margin: 'var(--space-6) 0' }} />
      <ProjectForm action={createProjectAction} submitLabel="Créer" />
    </div>
  )
}
