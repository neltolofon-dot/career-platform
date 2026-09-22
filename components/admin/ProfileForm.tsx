'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/admin/profile/actions'
import { updateProfileAction } from '@/app/admin/profile/actions'

type Profile = {
  fullName: string
  headline: string
  bio: string
  location: string
  timezone: string
  email: string
  availability: string
  openToWork: boolean
  socials: unknown
  resumeUrl: string | null
}

const initialState: FormState = {}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState)
  const err = (field: string) => state.fields?.[field]?.[0]
  const socials = (profile.socials ?? {}) as Record<string, string | undefined>

  return (
    <form action={formAction} style={{ maxWidth: '46rem' }}>
      <Field name="fullName" label="Nom complet" defaultValue={profile.fullName} error={err('fullName')} required />
      <Field name="headline" label="Déclaration d'ouverture" defaultValue={profile.headline} error={err('headline')} required />
      <Field name="bio" label="Bio" defaultValue={profile.bio} error={err('bio')} textarea rows={6} required />
      <Field name="location" label="Localisation" defaultValue={profile.location} error={err('location')} required />
      <Field name="timezone" label="Fuseau horaire" defaultValue={profile.timezone} error={err('timezone')} required />
      <Field name="email" label="Email" type="email" defaultValue={profile.email} error={err('email')} required />
      <Field
        name="availability"
        label="Disponibilité"
        defaultValue={profile.availability}
        error={err('availability')}
        hint="métadonnée vivante affichée en page d'accueil"
        required
      />

      <label className="mono" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <input type="checkbox" name="openToWork" defaultChecked={profile.openToWork} />
        Ouvert aux opportunités
      </label>

      <Field name="socialGithub" label="GitHub" type="url" defaultValue={socials.github ?? ''} />
      <Field name="socialLinkedin" label="LinkedIn" type="url" defaultValue={socials.linkedin ?? ''} />
      <Field name="socialX" label="X" type="url" defaultValue={socials.x ?? ''} />
      <Field name="socialFacebook" label="Facebook" type="url" defaultValue={socials.facebook ?? ''} />
      <Field name="resumeUrl" label="CV (URL)" type="url" defaultValue={profile.resumeUrl ?? ''} />

      {state.error && (
        <p className="field__error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mono" style={{ color: 'var(--color-positive)', marginBottom: 'var(--space-4)' }}>
          Profil mis à jour.
        </p>
      )}

      <button className="btn btn--primary" type="submit" disabled={pending}>
        {pending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  )
}

/** Sous-composant local : garde ProfileForm sous 150 lignes. */
function Field({
  name,
  label,
  defaultValue,
  error,
  hint,
  type = 'text',
  textarea = false,
  rows = 3,
  required = false,
}: {
  name: string
  label: string
  defaultValue?: string
  error?: string
  hint?: string
  type?: string
  textarea?: boolean
  rows?: number
  required?: boolean
}) {
  const id = `field-${name}`
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ')

  return (
    <div className="field" style={{ marginBottom: 'var(--space-6)' }}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>

      {textarea ? (
        <textarea
          className="field__input"
          id={id}
          name={name}
          rows={rows}
          defaultValue={defaultValue}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy || undefined}
        />
      ) : (
        <input
          className="field__input"
          id={id}
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy || undefined}
        />
      )}

      {hint && <span className="mono" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="field__error" id={`${id}-error`} role="alert">{error}</span>}
    </div>
  )
}
