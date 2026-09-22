'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/admin/skills/actions'

type Skill = {
  id?: string
  name?: string
  category?: string
  level?: number
  context?: string | null
  order?: number
}

export function SkillForm({
  action,
  skill = {},
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>
  skill?: Skill
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const err = (field: string) => state.fields?.[field]?.[0]

  return (
    <form action={formAction} style={{ maxWidth: '46rem' }}>
      <Field name="name" label="Nom" defaultValue={skill.name} error={err('name')} required />
      <Field name="category" label="Catégorie" defaultValue={skill.category} error={err('category')} required />
      <Field
        name="level"
        label="Niveau (1 à 5)"
        type="number"
        defaultValue={skill.level ?? 3}
        error={err('level')}
      />
      <Field
        name="context"
        label="Contexte"
        defaultValue={skill.context ?? ''}
        error={err('context')}
        hint="obligatoire — ex. « utilisé en production sur ColocBenin et GMP ». C'est ce texte qui compte, pas le niveau."
        textarea
        required
      />
      <Field name="order" label="Ordre" type="number" defaultValue={skill.order ?? 0} inline />

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

/** Sous-composant local : garde SkillForm sous 150 lignes. */
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
          rows={3}
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
