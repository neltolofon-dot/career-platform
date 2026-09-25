const MOVEMENTS = [
  { id: 'ouverture',   num: '00', label: 'Ouverture' },
  { id: 'travaux',     num: '01', label: 'Travaux' },
  { id: 'trajectoire', num: '02', label: 'Trajectoire' },
  { id: 'terrain',     num: '03', label: 'Terrain' },
  { id: 'dialogue',    num: '04', label: 'Dialogue' },
  { id: 'contact',     num: '05', label: 'Contact' },
] as const

/**
 * Dock des six mouvements. Il reprend la numérotation des sections :
 * la navigation parle la même langue que la page.
 *
 * Les `id` correspondent EXACTEMENT aux `id` posés par SectionFrame
 * (vérifiés dans le DOM rendu). Un id faux donne un dock qui ne
 * s'allume jamais, sans aucune erreur.
 */
export function MovementDock() {
  return (
    <nav className="dock" aria-label="Mouvements de la page" data-on="false">
      <span className="dock__pill" aria-hidden="true" />
      {MOVEMENTS.map((m) => (
        <a key={m.id} className="dock__link" href={`#${m.id}`} aria-current="false">
          <span className="dock__num">{m.num}</span>
          <span className="dock__label">{m.label}</span>
        </a>
      ))}
    </nav>
  )
}
