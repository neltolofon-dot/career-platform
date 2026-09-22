import { requireAdminPage } from '@/lib/auth/guard'
import { ExperienceForm } from '@/components/admin/ExperienceForm'
import { createExperienceAction } from '../actions'

export const metadata = { title: 'Nouvelle expérience', robots: { index: false } }

export default async function NewExperiencePage() {
  await requireAdminPage()

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">Nouvelle expérience</h1>
      <hr className="rule" style={{ margin: 'var(--space-6) 0' }} />
      <ExperienceForm action={createExperienceAction} submitLabel="Créer" />
    </div>
  )
}
