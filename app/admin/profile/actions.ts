'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminApi } from '@/lib/auth/guard'
import { updateProfile, ValidationError, ConflictError } from '@/lib/services/profile'

export type FormState = {
  error?: string
  success?: boolean
  fields?: Record<string, string[]>
}

function formToObject(formData: FormData) {
  return {
    fullName: formData.get('fullName'),
    headline: formData.get('headline'),
    bio: formData.get('bio'),
    location: formData.get('location'),
    timezone: formData.get('timezone'),
    email: formData.get('email'),
    availability: formData.get('availability'),
    openToWork: formData.get('openToWork') === 'on',
    socials: {
      github: String(formData.get('socialGithub') ?? ''),
      linkedin: String(formData.get('socialLinkedin') ?? ''),
      x: String(formData.get('socialX') ?? ''),
      facebook: String(formData.get('socialFacebook') ?? ''),
    },
    resumeUrl: String(formData.get('resumeUrl') ?? ''),
  }
}

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdminApi()

  try {
    await updateProfile(formToObject(formData))
  } catch (error) {
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

  // Pas de redirect() : contrairement aux collections, il n'y a nulle part
  // ailleurs où aller après avoir modifié un singleton — on reste sur la
  // même page et on affiche une confirmation.
  revalidatePath('/admin/profile')
  revalidatePath('/')
  return { success: true }
}
