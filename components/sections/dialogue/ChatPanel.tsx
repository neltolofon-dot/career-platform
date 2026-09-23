'use client'

// "use client" justifié : état de conversation, saisie et appel réseau.
// Avec ContactForm, l'un des deux seuls composants client de l'accueil.

import { useState, useRef } from 'react'

type Citation = { title: string; sourceType: string; sourceId: string }
type Msg = { role: 'user' | 'assistant'; text: string; citations?: Citation[]; refused?: boolean }

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
          { role: 'assistant', text: data.error ?? 'Une erreur est survenue.' },
        ])
        return
      }

      setSessionId(data.sessionId)
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: data.answer, citations: data.citations, refused: data.refused },
      ])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'Connexion impossible.' }])
    } finally {
      setPending(false)
    }
  }

  return (
    <div style={{ marginTop: 'var(--space-8)' }}>
      {messages.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                paddingBlock: 'var(--space-4)',
                borderTop: 'var(--rule-width) solid var(--color-rule)',
              }}
            >
              <span className="mono">{m.role === 'user' ? 'Vous' : 'Assistant'}</span>
              <p className="prose-body" style={{ marginTop: 'var(--space-2)' }}>
                {m.text}
              </p>

              {/* Les sources sont la PREUVE VISUELLE que le RAG est réel.
                  Un auditeur qui voit une réponse sourcée et cliquable
                  n'a plus besoin de demander si le chatbot est truqué. */}
              {m.citations && m.citations.length > 0 && (
                <p className="mono" style={{ marginTop: 'var(--space-3)' }}>
                  Sources ·{' '}
                  {m.citations.map((c, j) => (
                    <span key={j}>
                      {j > 0 && ' · '}
                      {c.sourceType === 'PROJECT' ? (
                        <a href={`/travaux/${c.sourceId}`}>{c.title}</a>
                      ) : (
                        c.title
                      )}
                    </span>
                  ))}
                </p>
              )}
            </div>
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
          className="field__input"
          placeholder="Ex. : quels projets a-t-il menés en cybersécurité ?"
          maxLength={500}
          disabled={pending}
          style={{ width: '100%' }}
        />
        <button className="btn" type="submit" disabled={pending} style={{ marginTop: 'var(--space-4)' }}>
          {pending ? 'Recherche…' : 'Demander'}
        </button>
      </form>

      {messages.length === 0 && (
        <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="mono"
              onClick={() => ask(s)}
              style={{ background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
            >
              → {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
