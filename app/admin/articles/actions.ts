'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdminApi } from '@/lib/auth/guard'
import {
  createArticle,
  updateArticle,
  deleteArticle,
  ValidationError,
  ConflictError,
} from '@/lib/services/articles'

export type FormState = {
  error?: string
  fields?: Record<string, string[]>
}

function formToObject(formData: FormData) {
  return {
    slug: formData.get('slug'),
    title: formData.get('title'),
    excerpt: formData.get('excerpt'),
    content: formData.get('content'),
    tags: String(formData.get('tags') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    status: formData.get('status'),
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

export async function createArticleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdminApi()

  try {
    await createArticle(formToObject(formData))
  } catch (error) {
    return toFormState(error)
  }

  revalidatePath('/admin/articles')
  revalidatePath('/')
  redirect('/admin/articles')
}

export async function updateArticleAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdminApi()

  try {
    await updateArticle(id, formToObject(formData))
  } catch (error) {
    return toFormState(error)
  }

  revalidatePath('/admin/articles')
  revalidatePath('/')
  redirect('/admin/articles')
}

export async function deleteArticleAction(formData: FormData) {
  await requireAdminApi()

  const id = String(formData.get('id') ?? '')
  if (!id) return

  await deleteArticle(id)
  revalidatePath('/admin/articles')
  revalidatePath('/')
}
