import { requireAdminPage } from '@/lib/auth/guard'
import { SkillForm } from '@/components/admin/SkillForm'
import { createSkillAction } from '../actions'

export const metadata = { title: 'Nouvelle compétence', robots: { index: false } }

export default async function NewSkillPage() {
  await requireAdminPage()

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">Nouvelle compétence</h1>
      <hr className="rule" style={{ margin: 'var(--space-6) 0' }} />
      <SkillForm action={createSkillAction} submitLabel="Créer" />
    </div>
  )
}
