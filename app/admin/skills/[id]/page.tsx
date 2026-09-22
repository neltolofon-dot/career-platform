import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth/guard'
import { getSkillForAdmin, NotFoundError } from '@/lib/services/skills'
import { SkillForm } from '@/components/admin/SkillForm'
import { updateSkillAction } from '../actions'

export const metadata = { title: 'Modifier une compétence', robots: { index: false } }

export default async function EditSkillPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminPage()
  const { id } = await params

  let skill
  try {
    skill = await getSkillForAdmin(id)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  const action = updateSkillAction.bind(null, id)

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">{skill.name}</h1>
      <hr className="rule" style={{ margin: 'var(--space-6) 0' }} />
      <SkillForm action={action} submitLabel="Enregistrer" skill={skill} />
    </div>
  )
}
