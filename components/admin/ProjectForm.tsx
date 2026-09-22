'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/admin/projects/actions'

type Project = {
  id?: string
  slug?: string
  title?: string
  summary?: string
  content?: string
  role?: string
  domain?: string
  year?: number
  stack?: string[]
  outcomes?: string[]
  links?: { live?: string; repo?: string }
  status?: string
  featured?: boolean
  order?: number
}

export function ProjectForm({
  action,
  project = {},
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>
  project?: Project
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, {})

  const err = (field: string) => state.fields?.[field]?.[0]

  return (
    <form action={formAction} style={{ maxWidth: '46rem' }}>
      <Field name="title" label="Titre" defaultValue={project.title} error={err('title')} required />
      <Field
        name="slug"
        label="Slug (URL)"
        defaultValue={project.slug}
        error={err('slug')}
        hint="minuscules, chiffres et tirets"
        required
      />
      <Field
        name="summary"
        label="Résumé"
        defaultValue={project.summary}
        error={err('summary')}
        hint="1 à 2 phrases — sert aussi de source au chatbot"
        textarea
        required
      />
      <Field name="role" label="Rôle" defaultValue={project.role} error={err('role')} required />
      <Field name="domain" label="Domaine" defaultValue={project.domain} error={err('domain')} required />
      <Field name="year" label="Année" type="number" defaultValue={project.year} error={err('year')} required />
      <Field
        name="stack"
        label="Stack"
        defaultValue={project.stack?.join(', ')}
        hint="séparée par des virgules"
        error={err('stack')}
      />
      <Field
        name="outcomes"
        label="Résultats"
        defaultValue={project.outcomes?.join('\n')}
        hint="un par ligne"
        textarea
        error={err('outcomes')}
      />
      <Field name="linkLive" label="Lien en ligne" type="url" defaultValue={project.links?.live} />
      <Field name="linkRepo" label="Dépôt" type="url" defaultValue={project.links?.repo} />
      <Field
        name="content"
        label="Contenu détaillé"
        defaultValue={project.content}
        hint="markdown — décisions techniques, contexte, difficultés"
        textarea
        rows={14}
        error={err('content')}
      />

      <div className="field" style={{ marginBottom: 'var(--space-6)' }}>
        <label className="field__label" htmlFor="status">Statut</label>
        <select
          className="field__input"
          id="status"
          name="status"
          defaultValue={project.status ?? 'DRAFT'}
        >
          <option value="DRAFT">Brouillon</option>
          <option value="PUBLISHED">Publié</option>
          <option value="ARCHIVED">Archivé</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
        <label className="mono" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" name="featured" defaultChecked={project.featured} />
          Mis en avant
        </label>
        <Field name="order" label="Ordre" type="number" defaultValue={project.order ?? 0} inline />
      </div>

      {state.error && (
        <p className="field__error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {state.error}
        </p>
      )}

      <button className="btn btn--primary" type="submit" disabled={pending}>
        {pending ? 'Enregistrement…' : submitLabel}
      </button>
    </form>
  )
}

/** Sous-composant local : garde ProjectForm sous 150 lignes. */
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
  inline = false,
}: {
  name: string
  label: string
  defaultValue?: string | number
  error?: string
  hint?: string
  type?: string
  textarea?: boolean
  rows?: number
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

      {hint && (
        <span className="mono" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
