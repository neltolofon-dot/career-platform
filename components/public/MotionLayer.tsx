'use client'

// "use client" justifié : écouteurs pointeur/défilement et IntersectionObserver.
// C'est le SEUL composant client ajouté par la couche mouvement (D26).

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { setupProgressFallback, setupPointer } from '@/lib/motion/pointer'
import { setupDock } from '@/lib/motion/dock'

/**
 * Couche mouvement — décision D26.
 *
 * Tout ce qui suit le DÉFILEMENT est en CSS (globals.css). Ce composant ne
 * s'occupe que de ce que le CSS ne sait pas faire : suivre le pointeur et
 * arbitrer l'état du dock. Il ne rend aucun élément visible et n'enveloppe
 * aucune section : les Server Components le restent.
 *
 * Dépendance au chemin : le layout survit aux navigations côté client. Sans
 * elle, revenir sur l'accueil depuis /travaux/… laisserait le dock éteint,
 * #ouverture n'existant pas au premier montage.
 */
export function MotionLayer() {
  const pathname = usePathname()

  useEffect(() => {
    let cleanups: Array<() => void> = []
    const start = () => {
      cleanups = [setupProgressFallback(), setupPointer(), setupDock()]
    }
    // Hors de la tâche d'hydratation : rien ici n'est utile avant que la page
    // soit interactive, et l'y exécuter allonge le Total Blocking Time.
    const idle = typeof window.requestIdleCallback === 'function'
    const handle = idle ? window.requestIdleCallback(start, { timeout: 2000 }) : window.setTimeout(start, 1)
    return () => {
      if (idle) window.cancelIdleCallback(handle)
      else window.clearTimeout(handle)
      for (const fn of cleanups) fn()
    }
  }, [pathname])

  return null
}
