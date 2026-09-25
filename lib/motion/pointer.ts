const GLASSY = '.btn, .dock__link, .dock__cta, .social-link, [data-glass]'
const MAGNETIC = '.btn, .dock__cta, [data-magnetic]'

/** Repli de la barre de progression si `animation-timeline: scroll()` n'est pas géré. */
export function setupProgressFallback(): () => void {
  if (CSS.supports('animation-timeline', 'scroll()')) return () => {}
  const bar = document.querySelector<HTMLElement>('.progress__bar')
  if (!bar) return () => {}

  let queued = false
  const onScroll = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      const max = document.documentElement.scrollHeight - window.innerHeight
      bar.style.setProperty('--p', max > 0 ? String(window.scrollY / max) : '0')
    })
  }
  addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  return () => removeEventListener('scroll', onScroll)
}

/** Reflet spéculaire (.lg) et aimantation des boutons. Pointeur fin uniquement. */
export function setupPointer(): () => void {
  document.querySelectorAll<HTMLElement>(GLASSY).forEach((el) => el.classList.add('lg'))

  const soft = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const fine = window.matchMedia('(pointer: fine)').matches
  if (!fine || soft) return () => {}

  const onMove = (event: PointerEvent) => {
    if (!(event.target instanceof Element)) return
    const el = event.target.closest<HTMLElement>('.lg')
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${((event.clientX - r.left) / r.width) * 100}%`)
    el.style.setProperty('--my', `${((event.clientY - r.top) / r.height) * 100}%`)
  }
  document.addEventListener('pointermove', onMove, { passive: true })

  // La transition de `translate` est déclarée dans .lg (globals.css), pas
  // posée ici : un `style.transition` inline écraserait celles de .btn, et
  // lire getComputedStyle au montage force un recalcul de style complet.
  const magnets = Array.from(document.querySelectorAll<HTMLElement>(MAGNETIC))

  let frame = 0
  const onPull = (event: PointerEvent) => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      for (const el of magnets) {
        const r = el.getBoundingClientRect()
        const dx = event.clientX - (r.left + r.width / 2)
        const dy = event.clientY - (r.top + r.height / 2)
        const reach = Math.max(r.width, r.height) * 1.15
        const d = Math.hypot(dx, dy)
        if (d < reach) {
          const f = (1 - d / reach) * 0.3
          el.style.translate = `${dx * f}px ${dy * f}px`
        } else if (el.style.translate) {
          el.style.translate = '0px 0px'
        }
      }
    })
  }
  document.addEventListener('pointermove', onPull, { passive: true })

  return () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointermove', onPull)
    if (frame) cancelAnimationFrame(frame)
    for (const el of magnets) el.style.translate = ''
  }
}
