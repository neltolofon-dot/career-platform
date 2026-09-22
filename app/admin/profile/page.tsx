import { requireAdminPage } from '@/lib/auth/guard'
import { getProfileForAdmin } from '@/lib/services/profile'
import { ProfileForm } from '@/components/admin/ProfileForm'

export const metadata = { title: 'Profil', robots: { index: false } }

/**
 * Pas de /admin/profile/new ni /admin/profile/[id] : Profile est un
 * singleton, cette unique page couvre lecture et édition.
 */
export default async function AdminProfilePage() {
  await requireAdminPage()

  const profile = await getProfileForAdmin()

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">Profil</h1>
      <hr className="rule" style={{ margin: 'var(--space-6) 0' }} />
      <ProfileForm profile={profile} />
    </div>
  )
}
