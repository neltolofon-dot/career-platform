import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth/guard'
import { getExperienceForAdmin, NotFoundError } from '@/lib/services/experiences'
import { ExperienceForm } from '@/components/admin/ExperienceForm'
import { updateExperienceAction } from '../actions'

export const metadata = { title: 'Modifier une expérience', robots: { index: false } }

export default async function EditExperiencePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminPage()
  const { id } = await params

  let experience
  try {
    experience = await getExperienceForAdmin(id)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  const action = updateExperienceAction.bind(null, id)

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">{experience.org}</h1>
      <hr className="rule" style={{ margin: 'var(--space-6) 0' }} />
      <ExperienceForm action={action} submitLabel="Enregistrer" experience={experience} />
    </div>
  )
}
