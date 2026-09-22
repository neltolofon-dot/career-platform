'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdminApi } from '@/lib/auth/guard'
import {
  createExperience,
  updateExperience,
  deleteExperience,
  ValidationError,
  ConflictError,
} from '@/lib/services/experiences'

export type FormState = {
  error?: string
  fields?: Record<string, string[]>
}

function formToObject(formData: FormData) {
  const endDate = String(formData.get('endDate') ?? '').trim()

  return {
    org: formData.get('org'),
    role: formData.get('role'),
    location: formData.get('location'),
    startDate: formData.get('startDate'),
    endDate: endDate === '' ? null : endDate,
    current: formData.get('current') === 'on',
    summary: formData.get('summary'),
    highlights: String(formData.get('highlights') ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    status: formData.get('status'),
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

export async function createExperienceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdminApi()

  try {
    await createExperience(formToObject(formData))
  } catch (error) {
    return toFormState(error)
  }

  revalidatePath('/admin/experiences')
  revalidatePath('/')
  redirect('/admin/experiences')
}

export async function updateExperienceAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdminApi()

  try {
    await updateExperience(id, formToObject(formData))
  } catch (error) {
    return toFormState(error)
  }

  revalidatePath('/admin/experiences')
  revalidatePath('/')
  redirect('/admin/experiences')
}

export async function deleteExperienceAction(formData: FormData) {
  await requireAdminApi()

  const id = String(formData.get('id') ?? '')
  if (!id) return

  await deleteExperience(id)
  revalidatePath('/admin/experiences')
  revalidatePath('/')
}
