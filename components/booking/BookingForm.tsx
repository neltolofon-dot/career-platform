'use client'

// "use client" justifié : sélection d'un créneau, état de soumission,
// appel réseau. Les créneaux eux-mêmes sont calculés côté serveur.

import { useState } from 'react'

type Day = { date: string; label: string; slots: { iso: string; label: string }[] }

export function BookingForm({ serviceSlug, days }: { serviceSlug: string; days: Day[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [cancelUrl, setCancelUrl] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selected) return

    setState('sending')
    const fd = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceSlug,
          startsAt: selected,
          name: fd.get('name'),
          email: fd.get('email'),
          note: fd.get('note'),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setCancelUrl(`/annuler/${data.cancelToken}`)
        setState('done')
        return
      }

      // 409 : quelqu'un a réservé pendant qu'on remplissait le formulaire.
      setError(res.status === 409 ? data.error : data.error ?? 'Erreur')
      setState('error')
    } catch {
      setError('Connexion impossible.')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div role="status">
        <p className="prose-body">
          Demande enregistrée. Vous recevrez une confirmation après validation.
        </p>
        <p className="mono" style={{ marginTop: 'var(--space-4)' }}>
          Lien d’annulation : <a href={cancelUrl}>{cancelUrl}</a>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit}>
      <fieldset style={{ border: 0, padding: 0, margin: '0 0 var(--space-8)' }}>
        <legend className="field__label">Créneau</legend>

        {days.map((day) => (
          <div key={day.date} style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ marginBottom: 'var(--space-2)' }}>
              <span className="mono">{day.label}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {day.slots.map((slot) => (
                <label
                  key={slot.iso}
                  className="mono"
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    border: `var(--rule-width) solid ${
                      selected === slot.iso ? 'var(--color-vermilion)' : 'var(--color-rule)'
                    }`,
                    cursor: 'pointer',
                    color: selected === slot.iso ? 'var(--color-vermilion)' : 'var(--color-ink)',
                  }}
                >
                  <input
                    type="radio"
                    name="slot"
                    value={slot.iso}
                    checked={selected === slot.iso}
                    onChange={() => setSelected(slot.iso)}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                  />
                  {slot.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      <div className="field" style={{ marginBottom: 'var(--space-6)' }}>
        <label className="field__label" htmlFor="b-name">Nom *</label>
        <input className="field__input" id="b-name" name="name" required maxLength={120} />
      </div>

      <div className="field" style={{ marginBottom: 'var(--space-6)' }}>
        <label className="field__label" htmlFor="b-email">E-mail *</label>
        <input className="field__input" id="b-email" name="email" type="email" required maxLength={254} />
      </div>

      <div className="field" style={{ marginBottom: 'var(--space-8)' }}>
        <label className="field__label" htmlFor="b-note">Objet du rendez-vous</label>
        <textarea className="field__input" id="b-note" name="note" rows={4} maxLength={1000} />
      </div>

      {state === 'error' && (
        <p className="field__error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </p>
      )}

      <button className="btn btn--primary" type="submit" disabled={!selected || state === 'sending'}>
        {state === 'sending' ? 'Réservation…' : 'Réserver ce créneau'}
      </button>
    </form>
  )
}
