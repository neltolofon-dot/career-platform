'use client'

// "use client" justifié : état d'envoi du formulaire, soumission et appel réseau.

import { useState, useRef } from 'react'

export function ContactForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('sending')

    const fd = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          email: fd.get('email'),
          company: fd.get('company'),
          message: fd.get('message'),
          website: fd.get('website'), // piège à robots
        }),
      })

      if (res.ok) {
        setState('sent')
        formRef.current?.reset()
        return
      }

      const data = await res.json()
      setError(data.error === 'Validation' ? 'Vérifiez les champs.' : data.error)
      setState('error')
    } catch {
      setError('Connexion impossible.')
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <p className="prose-body" role="status">
        Message reçu. Je vous réponds sous 48 heures.
      </p>
    )
  }

  return (
    <form ref={formRef} onSubmit={onSubmit}>
      <Field name="name" label="Nom" required />
      <Field name="email" label="E-mail" type="email" required />
      <Field name="company" label="Société" />
      <Field name="message" label="Message" textarea required />

      {/* Piège à robots : hors flux visuel, hors ordre de tabulation,
          masqué aux lecteurs d'écran. Un humain ne le remplit jamais. */}
      <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
        <label htmlFor="website">Ne pas remplir</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state === 'error' && (
        <p className="field__error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </p>
      )}

      <button className="btn btn--primary" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Envoi…' : 'Envoyer'}
      </button>
    </form>
  )
}

function Field({
  name,
  label,
  type = 'text',
  textarea = false,
  required = false,
}: {
  name: string
  label: string
  type?: string
  textarea?: boolean
  required?: boolean
}) {
  const id = `contact-${name}`
  return (
    <div className="field" style={{ marginBottom: 'var(--space-6)' }}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {textarea ? (
        <textarea className="field__input" id={id} name={name} rows={6} required={required} maxLength={4000} />
      ) : (
        <input className="field__input" id={id} name={name} type={type} required={required} maxLength={254} />
      )}
    </div>
  )
}
