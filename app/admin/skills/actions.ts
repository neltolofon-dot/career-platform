'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdminApi } from '@/lib/auth/guard'
import {
  createSkill,
  updateSkill,
  deleteSkill,
  ValidationError,
  ConflictError,
} from '@/lib/services/skills'

export type FormState = {
  error?: string
  fields?: Record<string, string[]>
}

function formToObject(formData: FormData) {
  return {
    name: formData.get('name'),
    category: formData.get('category'),
    level: formData.get('level'),
    context: formData.get('context'),
    order: formData.get('order'),
  }
}

function toFormState(error: unknown): FormState {
  if (error instanceof ValidationError) {
    return { error: 'Certains champs sont invalides.', fields: error.fields }
  }
  if (error instanceof ConflictError) {
    return { error: error.message }
  }

  const ref = crypto.randomUUID()
  console.error(JSON.stringify({ level: 'error', ref, error: String(error) }))
  return { error: `Une erreur est survenue. Référence : ${ref}` }
}

export async function createSkillAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdminApi()

  try {
    await createSkill(formToObject(formData))
  } catch (error) {
    return toFormState(error)
  }

  revalidatePath('/admin/skills')
  revalidatePath('/')
  redirect('/admin/skills')
}

export async function updateSkillAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdminApi()

  try {
    await updateSkill(id, formToObject(formData))
  } catch (error) {
    return toFormState(error)
  }

  revalidatePath('/admin/skills')
  revalidatePath('/')
  redirect('/admin/skills')
}

export async function deleteSkillAction(formData: FormData) {
  await requireAdminApi()

  const id = String(formData.get('id') ?? '')
  if (!id) return

  await deleteSkill(id)
  revalidatePath('/admin/skills')
  revalidatePath('/')
}
