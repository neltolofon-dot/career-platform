export type Citation = { title: string; sourceType: string; sourceId: string; href: string | null }

export type Msg = {
  role: 'user' | 'assistant'
  text: string
  citations?: Citation[]
  refused?: boolean
  // 'unavailable' = panne amont annoncée par l'API (503 retryable) ;
  // 'error' = défaut technique. Affichés différemment.
  status?: 'unavailable' | 'error'
}

function label(m: Msg): string {
  if (m.role === 'user') return 'Vous'
  if (m.status === 'unavailable') return 'Assistant · indisponible'
  if (m.status === 'error') return 'Erreur'
  return 'Assistant'
}

export function ChatMessage({ message: m }: { message: Msg }) {
  return (
    <div className="chat-msg">
      <span className="mono">{label(m)}</span>
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
              {c.href ? <a href={c.href}>{c.title}</a> : c.title}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
