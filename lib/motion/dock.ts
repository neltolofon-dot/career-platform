/**
 * Dock : visible une fois l'Ouverture quittée, masqué quand on descend,
 * pastille posée sous l'entrée de la section courante.
 */
export function setupDock(): () => void {
  const dock = document.querySelector<HTMLElement>('.dock')
  const opening = document.getElementById('ouverture')
  if (!dock || !opening || !('IntersectionObserver' in window)) return () => {}

  const pill = dock.querySelector<HTMLElement>('.dock__pill')
  const links = Array.from(dock.querySelectorAll<HTMLAnchorElement>('.dock__link'))
  const currentLink = () => links.find((a) => a.getAttribute('aria-current') === 'true')

  const place = (link: HTMLElement | undefined) => {
    if (!pill) return
    if (!link) { pill.style.opacity = '0'; return }
    pill.style.opacity = '1'
    pill.style.width = `${link.offsetWidth}px`
    pill.style.transform = `translateX(${link.offsetLeft}px)`
  }

  const gate = new IntersectionObserver(
    ([entry]) => { dock.dataset.on = String(!entry.isIntersecting) },
    { rootMargin: '-55% 0px 0px 0px' },
  )
  gate.observe(opening)

  const seen = new Map<string, boolean>()
  const order = links.map((a) => a.getAttribute('href')?.slice(1) ?? '').filter(Boolean)
  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting)
      const current = [...order].reverse().find((id) => seen.get(id)) ?? order[0]
      for (const a of links) {
        a.setAttribute('aria-current', String(a.getAttribute('href') === `#${current}`))
      }
      place(currentLink())
    },
    { rootMargin: '-25% 0px -55% 0px' },
  )
  for (const id of order) {
    const node = document.getElementById(id)
    if (node) spy.observe(node)
  }

  // Un clic dans le dock déclenche un défilement vers le bas : sans ce gel,
  // le dock se masquerait aussitôt et la pastille glisserait hors de vue.
  const hasScrollEnd = 'onscrollend' in window
  let jumping = false
  let release = 0
  const endJump = () => { jumping = false; window.clearTimeout(release) }
  const onJump = () => {
    jumping = true
    dock.dataset.away = 'false'
    window.clearTimeout(release)
    // Repli uniquement sans `scrollend` : un délai fixe couperait le gel au
    // milieu d'un long défilement doux (Ouverture → Contact).
    if (!hasScrollEnd) release = window.setTimeout(endJump, 1500)
  }

  let lastY = window.scrollY
  let pending = false
  const onScroll = () => {
    if (pending) return
    pending = true
    requestAnimationFrame(() => {
      pending = false
      if (jumping) { lastY = window.scrollY; return }
      if (window.scrollY > lastY + 4) dock.dataset.away = 'true'
      else if (window.scrollY < lastY - 4) dock.dataset.away = 'false'
      lastY = window.scrollY
    })
  }
  const wake = () => { dock.dataset.away = 'false' }
  const onResize = () => place(currentLink())
  addEventListener('scroll', onScroll, { passive: true })
  addEventListener('scrollend', endJump)
  addEventListener('resize', onResize, { passive: true })
  dock.addEventListener('click', onJump)
  dock.addEventListener('pointerenter', wake)
  // Le clavier doit pouvoir rouvrir un dock escamoté : sinon Tab atterrit
  // sur un lien à opacité 0 et le contour de focus est invisible.
  dock.addEventListener('focusin', wake)

  return () => {
    gate.disconnect()
    spy.disconnect()
    removeEventListener('scroll', onScroll)
    removeEventListener('scrollend', endJump)
    removeEventListener('resize', onResize)
    dock.removeEventListener('click', onJump)
    window.clearTimeout(release)
    dock.removeEventListener('pointerenter', wake)
    dock.removeEventListener('focusin', wake)
  }
}
