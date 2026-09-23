'use client'

// "use client" justifié : interrogation périodique (useEffect + setInterval)
// et état d'ouverture de la liste.

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Notification = {
  id: string
  title: string
  body: string
  entityType: string
  entityId: string
}

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    let lastVersion = -1

    async function poll() {
      try {
        const res = await fetch('/api/admin/notifications')
        if (!res.ok) return
        const data = await res.json()

        // La version Redis évite de réécrire l'état quand rien n'a bougé :
        // pas de re-rendu inutile toutes les 10 secondes.
        if (alive && data.version !== lastVersion) {
          lastVersion = data.version
          setItems(data.notifications)
        }
      } catch {
        // silencieux : une notification manquée n'est pas critique
      }
    }

    poll()
    const id = setInterval(poll, 10_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  return (
    <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
      <button
        type="button"
        className="mono"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          background: 'none',
          border: 0,
          cursor: 'pointer',
          color: items.length ? 'var(--color-vermilion)' : 'var(--color-ink-muted)',
        }}
      >
        Notifications {items.length > 0 && `· ${items.length}`}
      </button>

      {open && items.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-2) 0 0' }}>
          {items.map((n) => (
            <li
              key={n.id}
              style={{
                paddingBlock: 'var(--space-2)',
                borderTop: 'var(--rule-width) solid var(--color-rule)',
              }}
            >
              <Link
                href={n.entityType === 'conversation' ? `/admin/messages/${n.entityId}` : '/admin/leads'}
                style={{ fontSize: 'var(--text-xs)' }}
              >
                {n.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
