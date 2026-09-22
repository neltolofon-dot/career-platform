import type { Metadata } from 'next'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = {
  title: 'Connexion',
  robots: { index: false, follow: false }, // hors index des moteurs
}

export default async function LoginPage() {
  // Déjà connecté : on n'affiche pas le formulaire
  const user = await getSession()
  if (user?.role === 'ADMIN') redirect('/admin')

  return (
    <main className="section" data-anchor="3-10">
      <div className="section__meta">
        <span className="mono">Accès</span>
        <span className="mono">Restreint</span>
      </div>

      <div className="section__body" style={{ maxWidth: '26rem' }}>
        <h1 className="display display--section">Connexion</h1>
        <hr className="rule" style={{ margin: 'var(--space-6) 0' }} />
        <LoginForm />
      </div>
    </main>
  )
}
