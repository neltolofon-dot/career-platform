'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/admin/experiences/actions'

type Experience = {
  id?: string
  org?: string
  role?: string
  location?: string | null
  startDate?: Date | string
  endDate?: Date | string | null
  current?: boolean
  summary?: string
  highlights?: string[]
  status?: string
  order?: number
}

function toDateInputValue(d?: Date | string | null) {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

export function ExperienceForm({
  action,
  experience = {},
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>
  experience?: Experience
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const err = (field: string) => state.fields?.[field]?.[0]

  return (
    <form action={formAction} style={{ maxWidth: '46rem' }}>
      <Field name="org" label="Organisation" defaultValue={experience.org} error={err('org')} required />
      <Field name="role" label="Rôle" defaultValue={experience.role} error={err('role')} required />
      <Field name="location" label="Lieu" defaultValue={experience.location ?? ''} error={err('location')} />
      <Field
        name="startDate"
        label="Début"
        type="date"
        defaultValue={toDateInputValue(experience.startDate)}
        error={err('startDate')}
        required
      />
      <Field
        name="endDate"
        label="Fin"
        type="date"
        defaultValue={toDateInputValue(experience.endDate)}
        error={err('endDate')}
        hint="laisser vide si en cours"
      />
      <label className="mono" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <input type="checkbox" name="current" defaultChecked={experience.current} />
        Poste actuel
      </label>
      <Field
        name="summary"
        label="Résumé"
        defaultValue={experience.summary}
        error={err('summary')}
        textarea
        required
      />
      <Field
        name="highlights"
        label="Faits marquants"
        defaultValue={experience.highlights?.join('\n')}
        hint="un par ligne"
        textarea
        error={err('highlights')}
      />

      <div className="field" style={{ marginBottom: 'var(--space-6)' }}>
        <label className="field__label" htmlFor="status">Statut</label>
        <select className="field__input" id="status" name="status" defaultValue={experience.status ?? 'PUBLISHED'}>
          <option value="DRAFT">Brouillon</option>
          <option value="PUBLISHED">Publié</option>
          <option value="ARCHIVED">Archivé</option>
        </select>
      </div>

      <Field name="order" label="Ordre" type="number" defaultValue={experience.order ?? 0} inline />

      {state.error && (
        <p className="field__error" role="alert" style={{ margin: 'var(--space-4) 0' }}>
          {state.error}
        </p>
      )}

      <button className="btn btn--primary" type="submit" disabled={pending} style={{ marginTop: 'var(--space-6)' }}>
        {pending ? 'Enregistrement…' : submitLabel}
      </button>
    </form>
  )
}

/** Sous-composant local : garde ExperienceForm sous 150 lignes. */
function Field({
  name,
  label,
  defaultValue,
  error,
  hint,
  type = 'text',
  textarea = false,
  required = false,
  inline = false,
}: {
  name: string
  label: string
  defaultValue?: string | number
  error?: string
  hint?: string
  type?: string
  textarea?: boolean
  required?: boolean
  inline?: boolean
}) {
  const id = `field-${name}`
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ')

  return (
    <div className="field" style={{ marginBottom: inline ? 0 : 'var(--space-6)' }}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>

      {textarea ? (
        <textarea
          className="field__input"
          id={id}
          name={name}
          rows={4}
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
