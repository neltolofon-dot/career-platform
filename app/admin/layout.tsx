import type { ReactNode } from 'react'
import { requireAdminPage } from '@/lib/auth/guard'
import { AdminNav } from '@/components/admin/AdminNav'
import { logoutAction } from './actions'

export const metadata = { robots: { index: false, follow: false } }

/**
 * Le layout appelle requireAdminPage() — mais ce n'est PAS suffisant :
 * chaque page l'appelle aussi.
 *
 * Raison : un layout ne protège que les pages qu'il enveloppe, et rien
 * ne garantit qu'une future route reste dans cet arbre. La protection
 * doit être lisible dans le fichier qu'on ouvre, pas déduite de
 * l'arborescence. Le coût est nul (une lecture de session cachée
 * en Redis), le bénéfice est qu'aucune page ne peut être ajoutée
 * sans protection par inattention.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminPage()

  return (
    <div className="admin" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr' }}>
      <aside
        style={{
          borderRight: 'var(--rule-width) solid var(--color-rule)',
          padding: 'var(--space-8) 0',
          minWidth: '13rem',
          position: 'sticky',
          top: 0,
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '0 var(--space-4) var(--space-6)' }}>
          <span className="mono">Admin</span>
        </div>

        <AdminNav />

        <form action={logoutAction} style={{ marginTop: 'auto', padding: 'var(--space-4)' }}>
          <p className="mono" style={{ marginBottom: 'var(--space-2)' }}>
            {user.email}
          </p>
          <button className="btn" type="submit" style={{ width: '100%' }}>
            Déconnexion
          </button>
        </form>
      </aside>

      <main style={{ minWidth: 0 }}>{children}</main>
    </div>
  )
}
