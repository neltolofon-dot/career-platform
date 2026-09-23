'use client'

// "use client" justifié : état de l'annulation et appel POST au clic.

import { useState } from 'react'

export function CancelButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')

  if (state === 'done') {
    return <p className="prose-body" role="status">Rendez-vous annulé. Le créneau est de nouveau disponible.</p>
  }

  return (
    <button
      className="btn btn--primary"
      disabled={state === 'sending'}
      onClick={async () => {
        setState('sending')
        await fetch(`/api/booking/cancel/${token}`, { method: 'POST' })
        setState('done')
      }}
    >
      {state === 'sending' ? 'Annulation…' : 'Confirmer l\'annulation'}
    </button>
  )
}
