'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdminApi } from '@/lib/auth/guard'
import {
  createProject,
  updateProject,
  deleteProject,
  ValidationError,
  ConflictError,
} from '@/lib/services/projects'

export type FormState = {
  error?: string
  fields?: Record<string, string[]>
}

/**
 * Transport « formulaire ». Aucune règle métier ici : on traduit un
 * FormData en objet, on appelle le service, on traduit l'erreur en
 * message affichable.
 *
 * requireAdminApi() est appelé explicitement : une Server Action est un
 * point d'entrée HTTP à part entière, appelable directement sans passer
 * par la page qui l'a rendue. Elle doit se protéger elle-même.
 */
function formToObject(formData: FormData) {
  return {
    slug: formData.get('slug'),
    title: formData.get('title'),
    summary: formData.get('summary'),
    content: formData.get('content'),
    role: formData.get('role'),
    domain: formData.get('domain'),
    year: formData.get('year'),
    stack: String(formData.get('stack') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    outcomes: String(formData.get('outcomes') ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    links: {
      live: String(formData.get('linkLive') ?? ''),
      repo: String(formData.get('linkRepo') ?? ''),
    },
    status: formData.get('status'),
    featured: formData.get('featured') === 'on',
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

export async function createProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdminApi()

  try {
    await createProject(formToObject(formData))
  } catch (error) {
    return toFormState(error)
  }

  revalidatePath('/admin/projects')
  revalidatePath('/')
  redirect('/admin/projects')
}

export async function updateProjectAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdminApi()

  try {
    await updateProject(id, formToObject(formData))
  } catch (error) {
    return toFormState(error)
  }

  revalidatePath('/admin/projects')
  revalidatePath('/')
  redirect('/admin/projects')
}

export async function deleteProjectAction(formData: FormData) {
  await requireAdminApi()

  const id = String(formData.get('id') ?? '')
  if (!id) return

  await deleteProject(id)
  revalidatePath('/admin/projects')
  revalidatePath('/')
}
