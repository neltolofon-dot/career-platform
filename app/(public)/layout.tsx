import type { ReactNode } from 'react'
import { getPublicProfile } from '@/lib/services/public'
import { SiteNav } from '@/components/public/SiteNav'
import { SiteFooter } from '@/components/public/SiteFooter'
import { MotionLayer } from '@/components/public/MotionLayer'
import { MovementDock } from '@/components/public/MovementDock'

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const profile = await getPublicProfile()

  const name = profile?.fullName ?? 'Portfolio'
  const socials = (profile?.socials ?? {}) as Record<string, string>

  return (
    <>
      <div className="progress" aria-hidden="true">
        <span className="progress__bar" />
      </div>
      <SiteNav name={name} />
      <MovementDock />
      {children}
      <SiteFooter name={name} email={profile?.email ?? ''} socials={socials} />
      <MotionLayer />
    </>
  )
}
