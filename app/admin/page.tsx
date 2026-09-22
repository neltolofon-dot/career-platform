import { requireAdminPage } from '@/lib/auth/guard'
import { logoutAction } from './actions'

export const metadata = { robots: { index: false, follow: false } }

export default async function AdminOverviewPage() {
  // ← PREMIÈRE LIGNE. Toujours. Dans chaque page admin.
  const user = await requireAdminPage()

  return (
    <main className="section admin" data-anchor="1-12">
      <div className="section__meta">
        <span className="mono">Admin</span>
        <span className="mono">Overview</span>
      </div>

      <div className="section__body">
        <h1 className="display display--section">Tableau de bord</h1>
        <p className="mono mono--data" style={{ marginTop: 'var(--space-4)' }}>
          {user.email} · {user.role}
        </p>

        <form action={logoutAction} style={{ marginTop: 'var(--space-8)' }}>
          <button className="btn" type="submit">Se déconnecter</button>
        </form>
      </div>
    </main>
  )
}
