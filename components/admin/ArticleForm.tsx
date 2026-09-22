'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/admin/articles/actions'

type Article = {
  id?: string
  slug?: string
  title?: string
  excerpt?: string
  content?: string
  tags?: string[]
  status?: string
  readingMinutes?: number
}

export function ArticleForm({
  action,
  article = {},
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>
  article?: Article
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const err = (field: string) => state.fields?.[field]?.[0]

  return (
    <form action={formAction} style={{ maxWidth: '46rem' }}>
      <Field name="title" label="Titre" defaultValue={article.title} error={err('title')} required />
      <Field
        name="slug"
        label="Slug (URL)"
        defaultValue={article.slug}
        error={err('slug')}
        hint="minuscules, chiffres et tirets"
        required
      />
      <Field
        name="excerpt"
        label="Chapô"
        defaultValue={article.excerpt}
        error={err('excerpt')}
        textarea
        required
      />
      <Field
        name="tags"
        label="Tags"
        defaultValue={article.tags?.join(', ')}
        hint="séparés par des virgules"
        error={err('tags')}
      />
      <Field
        name="content"
        label="Contenu"
        defaultValue={article.content}
        hint={
          article.readingMinutes
            ? `markdown — temps de lecture calculé : ${article.readingMinutes} min`
            : 'markdown — le temps de lecture est calculé automatiquement (200 mots/min)'
        }
        textarea
        rows={16}
        required
        error={err('content')}
      />

      <div className="field" style={{ marginBottom: 'var(--space-6)' }}>
        <label className="field__label" htmlFor="status">Statut</label>
        <select className="field__input" id="status" name="status" defaultValue={article.status ?? 'DRAFT'}>
          <option value="DRAFT">Brouillon</option>
          <option value="PUBLISHED">Publié</option>
          <option value="ARCHIVED">Archivé</option>
        </select>
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

/** Sous-composant local : garde ArticleForm sous 150 lignes. */
function Field({
  name,
  label,
  defaultValue,
  error,
  hint,
  textarea = false,
  rows = 3,
  required = false,
}: {
  name: string
  label: string
  defaultValue?: string
  error?: string
  hint?: string
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
          type="text"
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
