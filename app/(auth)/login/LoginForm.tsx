'use client'

// "use client" justifié : useActionState et l'état de soumission
// nécessitent React côté client. Le composant reste minimal —
// toute la logique d'authentification est dans la Server Action.

import { useActionState } from 'react'
import { loginAction, type LoginState } from './actions'

const initialState: LoginState = {}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState)

  return (
    <form action={formAction} noValidate>
      <div className="field" style={{ marginBottom: 'var(--space-6)' }}>
        <label className="field__label" htmlFor="email">
          Adresse e-mail
        </label>
        <input
          className="field__input"
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          aria-invalid={state.error ? 'true' : undefined}
        />
      </div>

      <div className="field" style={{ marginBottom: 'var(--space-8)' }}>
        <label className="field__label" htmlFor="password">
          Mot de passe
        </label>
        <input
          className="field__input"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.error ? 'true' : undefined}
        />
      </div>

      {state.error && (
        <p className="field__error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {state.error}
        </p>
      )}

      <button className="btn btn--primary" type="submit" disabled={pending}>
        {pending ? 'Vérification…' : 'Se connecter'}
      </button>
    </form>
  )
}
