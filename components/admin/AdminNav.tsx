'use client'

// "use client" justifié : usePathname pour marquer le lien actif.
// Aucune donnée, aucun appel réseau — le composant reste minimal.

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/profile', label: 'Profile' },
  { href: '/admin/projects', label: 'Projects' },
  { href: '/admin/experience', label: 'Experience' },
  { href: '/admin/skills', label: 'Skills' },
  { href: '/admin/articles', label: 'Articles' },
  { href: '/admin/media', label: 'Media' },
  { href: '/admin/leads', label: 'Leads' },
  { href: '/admin/messages', label: 'Messages' },
  { href: '/admin/calendar', label: 'Calendar' },
  { href: '/admin/assistant', label: 'AI Assistant' },
  { href: '/admin/analytics', label: 'Analytics' },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Navigation d'administration">
      {LINKS.map(({ href, label }) => {
        const active = href === '/admin' ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className="admin-nav__link"
            aria-current={active ? 'page' : undefined}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
