'use client'

// "use client" justifié : état de conversation, saisie et appel réseau.
// Avec ContactForm, l'un des deux seuls composants client de l'accueil.

import { useState, useRef } from 'react'
import { ChatMessage, type Msg } from './ChatMessage'

export function ChatPanel({ suggestions }: { suggestions: string[] }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [pending, setPending] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const inputRef = useRef<HTMLInputElement>(null)

  async function ask(question: string) {
    if (!question.trim() || pending) return

    setMessages((m) => [...m, { role: 'user', text: question }])
    setPending(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, sessionId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            text: data.error ?? 'Une erreur est survenue.',
            status: data.retryable ? 'unavailable' : 'error',
          },
        ])
        return
      }

      setSessionId(data.sessionId)
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: data.answer, citations: data.citations, refused: data.refused },
      ])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'Connexion impossible.', status: 'error' }])
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="chat-panel">
      {messages.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          {messages.map((m, i) => (
            <ChatMessage key={i} message={m} />
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const v = inputRef.current?.value ?? ''
          ask(v)
          if (inputRef.current) inputRef.current.value = ''
        }}
      >
        <label className="field__label" htmlFor="chat-input">
          Votre question
        </label>
        <input
          ref={inputRef}
          id="chat-input"
          className="field__input chat-panel__input"
          placeholder="Ex. : quels projets a-t-il menés en cybersécurité ?"
          maxLength={500}
          disabled={pending}
          style={{ width: '100%' }}
        />
        <button className="btn" type="submit" disabled={pending} style={{ marginTop: 'var(--space-4)' }}>
          {pending ? <span className="chat-thinking">Recherche…</span> : 'Demander'}
        </button>
      </form>

      {messages.length === 0 && (
        <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="chat-suggestion"
              onClick={() => ask(s)}
            >
              → {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
