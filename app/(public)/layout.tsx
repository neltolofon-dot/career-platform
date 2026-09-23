import type { ReactNode } from 'react'
import { getPublicProfile } from '@/lib/services/public'
import { SiteNav } from '@/components/public/SiteNav'
import { SiteFooter } from '@/components/public/SiteFooter'

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const profile = await getPublicProfile()

  const name = profile?.fullName ?? 'Portfolio'
  const socials = (profile?.socials ?? {}) as Record<string, string>

  return (
    <>
      <SiteNav name={name} />
      {children}
      <SiteFooter name={name} email={profile?.email ?? ''} socials={socials} />
    </>
  )
}
