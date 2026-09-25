# Bloc 16 — Couche mouvement + portrait détouré

**Contexte :** la soutenance est passée, le dépôt redevient le portfolio personnel.
On porte **deux choses** du prototype statique vers `career-platform`, et **deux
seulement**. Le reste (palette claire, DM Sans, enchaînement Hero/Services) est
volontairement laissé de côté : il contredirait les décisions qu'on défend.

---

## Les deux décisions de ce bloc

> Numérotées D26 et D27 le 25/09/2026 : D1 à D25 sont déjà prises dans
> `docs/` et dans le registre de `ARCHITECTURE.md`. Une première version de ce
> document les appelait D17/D18, en collision avec les décisions RAG de
> `docs/11-RAG-CODE.md`.

### D26 — Le mouvement n'est pas une raison de passer en Client Component

La couche mouvement est en **CSS scroll-driven animations** (`animation-timeline:
scroll()` et `view()`) pour tout ce qui suit le défilement, et en **Web Animations
API** pour ce qui suit le pointeur.

Conséquence : **aucune section publique ne gagne `"use client"`.** Un unique
composant client, monté une fois dans `app/(public)/layout.tsx`, se contente
d'écouter le pointeur et de poser des variables CSS. Il ne rend aucun contenu.

C'est le prolongement direct de **D16**, pas une entorse.

> *Alternative rejetée :* GSAP ScrollTrigger ou Framer Motion. Framer Motion
> impose de rendre les sections interactives côté client — exactement ce que D16
> interdit. GSAP ajoute ~70 Ko pour émuler des API que le navigateur expose déjà.

### D27 — Le disque derrière le portrait est sombre, pas vert

Sur le prototype à fond clair, le portrait se détache sur un disque `#60DD00`.
Impossible ici : la règle **« l'accent apparaît une seule fois par écran »** tombe
si un cercle de 480 px de vert occupe le premier écran.

Le disque devient donc `--color-elevated` avec **un liseré vert de 1 px** et une
lueur diffuse. L'unique occurrence de l'accent sur le premier écran, c'est la
**lumière de contour verte du portrait lui-même** — elle était dans la prise de
vue, elle a été préservée à l'incrustation.

> *Alternative rejetée :* garder le disque vert. Plus spectaculaire en capture
> d'écran, mais indéfendable la première fois qu'on demande pourquoi la charte
> dit une chose et la page une autre.

---

## Fichier 1 — `public/portrait.webp`

Dépose le fichier `portrait.webp` fourni (1046 × 1100, 64 Ko).

Le fond vert du studio est incrusté ; la **lumière de contour verte est conservée**
(elle fait partie de la photo). Les bords où les épaules sortaient du cadre sont
feutrés sur 78 px : sans ça, la silhouette se termine par une coupe droite nette.

**Supprime l'ancien fichier de portrait** une fois la bascule validée — ne laisse
pas deux portraits dans `public/`.

---

## Fichier 2 — à ajouter à la fin de `app/globals.css`

```css
/* ===================================================================
   BLOC 16 — COUCHE MOUVEMENT
   100 % natif : scroll-driven animations, @property, WAAPI.
   Aucune dépendance. Tout s'éteint sous prefers-reduced-motion.
   =================================================================== */

@property --mx { syntax:'<percentage>'; inherits:false; initial-value:50%; }
@property --my { syntax:'<percentage>'; inherits:false; initial-value:50%; }
@property --glow { syntax:'<number>'; inherits:false; initial-value:0; }

/* ---- 1. Barre de progression — zéro ligne de JS ---- */
.progress {
  position: fixed; inset: 0 0 auto; height: 2px; z-index: 90; pointer-events: none;
}
.progress__bar {
  height: 100%; transform-origin: 0 50%; transform: scaleX(var(--p, 0));
  background: linear-gradient(90deg, var(--color-accent-dim), var(--color-vermilion));
}
@supports (animation-timeline: scroll()) {
  .progress__bar {
    transform: scaleX(0);
    animation: progress-grow linear forwards;
    animation-timeline: scroll(root block);
  }
  @keyframes progress-grow { to { transform: scaleX(1); } }
}

/* ---- 2. Verre liquide — reflet spéculaire suivant le pointeur ----
   Sur fond sombre le reflet est blanc à faible opacité ; sur un aplat
   vert il doit être plus soutenu pour rester perceptible. */
.lg { position: relative; overflow: hidden; isolation: isolate;
      transition: transform var(--dur-state) var(--ease-out),
                  background var(--dur-state) var(--ease-out),
                  border-color var(--dur-state) var(--ease-out); }
.lg::after {
  content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit;
  pointer-events: none; opacity: var(--glow);
  background: radial-gradient(130px circle at var(--mx) var(--my),
              rgba(255,255,255,0.16), rgba(255,255,255,0) 62%);
  transition: opacity var(--dur-state) ease-out;
}
.lg--accent::after {
  background: radial-gradient(130px circle at var(--mx) var(--my),
              rgba(255,255,255,0.40), rgba(255,255,255,0) 62%);
}
.lg:hover { --glow: 1; }
.lg:active { transform: scale(0.97); transition-duration: var(--dur-micro); }

/* ---- 3. Dock des six mouvements ----
   Il reprend la numérotation 00–05 : même grammaire que les sections,
   pas un composant de navigation importé d'ailleurs. */
.dock {
  position: fixed; left: 50%; bottom: 20px; z-index: 85;
  display: flex; align-items: center; gap: 2px; padding: 5px;
  border-radius: 999px; border: 1px solid var(--color-rule);
  background: rgba(20, 20, 31, 0.72);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 22px 48px -30px #000;
  opacity: 0; visibility: hidden; pointer-events: none;
  transform: translate(-50%, 24px);
  transition: opacity var(--dur-enter) var(--ease),
              transform var(--dur-enter) var(--ease-out),
              visibility var(--dur-enter);
}
.dock[data-on="true"] { opacity: 1; visibility: visible; pointer-events: auto;
                        transform: translate(-50%, 0); }
.dock[data-away="true"] { opacity: 0; pointer-events: none;
                          transform: translate(-50%, 24px); }
.dock__pill {
  position: absolute; top: 5px; bottom: 5px; left: 0; width: 0; z-index: 0;
  border-radius: 999px; background: var(--color-vermilion); opacity: 0;
  transition: transform var(--dur-page) var(--ease-out),
              width var(--dur-page) var(--ease-out), opacity var(--dur-state);
}
.dock__link {
  position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 7px;
  min-height: 36px; padding: 0 13px; border-radius: 999px;
  font-family: var(--font-mono); font-size: var(--text-2xs);
  letter-spacing: var(--tracking-mono); text-transform: uppercase;
  color: var(--color-ink-muted); white-space: nowrap;
  transition: color var(--dur-state) var(--ease-out);
}
.dock__link[aria-current="true"] { color: #050505; font-weight: 600; }
.dock__num { opacity: 0.6; font-variant-numeric: tabular-nums; }
.dock__link[aria-current="true"] .dock__num { opacity: 0.75; }
@media (min-width: 1024px) {
  .dock { bottom: auto; top: 20px; transform: translate(-50%, -24px); }
  .dock[data-away="true"] { transform: translate(-50%, -24px); }
}
@media (max-width: 600px) { .dock__label { display: none; } .dock__link { padding: 0 11px; } }

/* ---- 4. Portrait : disque sombre, liseré vert, parallaxe ----
   La hauteur est FIXÉE en aspect-ratio : le décalage de mise en page
   doit rester à zéro, c'est un chiffre qu'on annonce. */
.portrait { position: relative; width: min(100%, 460px); aspect-ratio: 1 / 1.05;
            margin-inline: auto; }
.portrait::before {
  content: ""; position: absolute; z-index: 0;
  left: 2%; bottom: 0; width: 96%; aspect-ratio: 1; border-radius: 50%;
  background: radial-gradient(102% 102% at 28% 16%,
              var(--color-elevated) 0%, var(--color-surface) 58%, var(--color-paper) 100%);
  border: 1px solid var(--color-accent-soft);
  box-shadow: 0 40px 90px -50px rgba(96, 221, 0, 0.45);
}
.portrait::after {
  content: ""; position: absolute; z-index: -1; inset: auto -6% -8% -6%; height: 70%;
  background: radial-gradient(56% 50% at 50% 68%, rgba(96,221,0,0.16), transparent 72%);
  filter: blur(26px); pointer-events: none;
}
.portrait__img {
  position: absolute; z-index: 1; inset: -3% 5% 0 5%;
  width: 90%; height: 103%;
  object-fit: contain; object-position: bottom center;
}

@supports (animation-timeline: view()) {
  /* Deux vitesses = profondeur réelle, pas un effet plaqué. */
  .portrait__img { animation: portrait-figure linear both;
                   animation-timeline: view(block); animation-range: exit -5% exit 100%; }
  .portrait::before { animation: portrait-disc linear both;
                      animation-timeline: view(block); animation-range: exit -5% exit 100%; }
  @keyframes portrait-figure { to { translate: 0 -52px; scale: 1.02; } }
  @keyframes portrait-disc   { to { translate: 0 16px; scale: 0.9; opacity: 0.7; } }
}

/* ---- 5. Révélation des sections au défilement ----
   Remplace l'entrée `.enter` par une animation pilotée par la position
   RÉELLE dans la fenêtre, pas par un booléen d'IntersectionObserver. */
@supports (animation-timeline: view()) {
  .enter, .index-row {
    animation: reveal-in linear both;
    animation-timeline: view(block);
    animation-range: entry 4% cover 26%;
  }
  .index-row { animation-range: entry 2% cover 20%; }
  @keyframes reveal-in {
    from { opacity: 0; translate: 0 30px; filter: blur(6px); }
    to   { opacity: 1; translate: 0 0;   filter: blur(0); }
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress__bar { animation: none !important; transform: scaleX(var(--p, 0)); }
  .dock__pill { display: none; }
  .lg::after { display: none; }
  .lg:active { transform: none; }
  .portrait__img, .portrait::before, .enter, .index-row { animation: none !important; }
  .enter, .index-row { opacity: 1; translate: 0 0; filter: none; }
}
@media print { .progress, .dock { display: none !important; } }
```

---

## Fichier 3 — `components/public/MotionLayer.tsx` (nouveau)

Le **seul** composant client de la partie publique. Il ne rend rien qui porte du
contenu : il écoute, il pose des variables CSS, il bascule des attributs.

```tsx
'use client'

import { useEffect } from 'react'

const GLASSY = '.btn, .dock__link, .dock__cta, .social-link, [data-glass]'
const MAGNETIC = '.btn, .dock__cta, [data-magnetic]'

/**
 * Couche mouvement — décision D26.
 *
 * Tout ce qui suit le DÉFILEMENT est en CSS (globals.css). Ce composant ne
 * s'occupe que de ce que le CSS ne sait pas faire : suivre le pointeur et
 * arbitrer l'état du dock. Il ne rend aucun élément visible et n'enveloppe
 * aucune section : les Server Components le restent.
 */
export function MotionLayer() {
  useEffect(() => {
    const soft = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fine = window.matchMedia('(pointer: fine)').matches
    const cleanups: Array<() => void> = []

    // -- Repli de la barre de progression si scroll() n'est pas géré --
    if (!CSS.supports('animation-timeline', 'scroll()')) {
      const bar = document.querySelector<HTMLElement>('.progress__bar')
      if (bar) {
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
        cleanups.push(() => removeEventListener('scroll', onScroll))
      }
    }

    document.querySelectorAll<HTMLElement>(GLASSY).forEach((el) => el.classList.add('lg'))

    if (fine && !soft) {
      // -- Reflet spéculaire --
      const onMove = (event: PointerEvent) => {
        const target = event.target as Element | null
        const el = target?.closest<HTMLElement>('.lg')
        if (!el) return
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${((event.clientX - r.left) / r.width) * 100}%`)
        el.style.setProperty('--my', `${((event.clientY - r.top) / r.height) * 100}%`)
      }
      document.addEventListener('pointermove', onMove, { passive: true })
      cleanups.push(() => document.removeEventListener('pointermove', onMove))

      // -- Aimantation --
      const magnets = Array.from(document.querySelectorAll<HTMLElement>(MAGNETIC))
      magnets.forEach((el) => { el.style.transition = 'translate 550ms var(--ease-out)' })
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
      cleanups.push(() => {
        document.removeEventListener('pointermove', onPull)
        if (frame) cancelAnimationFrame(frame)
      })
    }

    // -- Dock : visible après le premier mouvement, masqué quand on descend --
    const dock = document.querySelector<HTMLElement>('.dock')
    const opening = document.getElementById('ouverture')
    if (dock && opening && 'IntersectionObserver' in window) {
      const pill = dock.querySelector<HTMLElement>('.dock__pill')
      const links = Array.from(dock.querySelectorAll<HTMLAnchorElement>('.dock__link'))

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
      cleanups.push(() => gate.disconnect())

      const seen = new Map<string, boolean>()
      const order = links
        .map((a) => a.getAttribute('href')?.slice(1) ?? '')
        .filter(Boolean)
      const spy = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting)
          const current = [...order].reverse().find((id) => seen.get(id)) ?? order[0]
          for (const a of links) {
            const on = a.getAttribute('href') === `#${current}`
            a.setAttribute('aria-current', String(on))
          }
          place(links.find((a) => a.getAttribute('aria-current') === 'true'))
        },
        { rootMargin: '-25% 0px -55% 0px' },
      )
      for (const id of order) {
        const node = document.getElementById(id)
        if (node) spy.observe(node)
      }
      cleanups.push(() => spy.disconnect())

      let lastY = window.scrollY
      let pending = false
      const onScroll = () => {
        if (pending) return
        pending = true
        requestAnimationFrame(() => {
          pending = false
          if (window.scrollY > lastY + 4) dock.dataset.away = 'true'
          else if (window.scrollY < lastY - 4) dock.dataset.away = 'false'
          lastY = window.scrollY
        })
      }
      addEventListener('scroll', onScroll, { passive: true })
      const wake = () => { dock.dataset.away = 'false' }
      dock.addEventListener('pointerenter', wake)
      const onResize = () => place(links.find((a) => a.getAttribute('aria-current') === 'true'))
      addEventListener('resize', onResize, { passive: true })
      cleanups.push(() => {
        removeEventListener('scroll', onScroll)
        removeEventListener('resize', onResize)
        dock.removeEventListener('pointerenter', wake)
      })
    }

    return () => { for (const fn of cleanups) fn() }
  }, [])

  return null
}
```

---

## Fichier 4 — `components/public/MovementDock.tsx` (nouveau, Server Component)

Aucun `"use client"` ici : c'est du balisage statique que `MotionLayer` pilote.

```tsx
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
 * ⚠️ Les `id` doivent correspondre EXACTEMENT aux `id` posés par
 * SectionFrame. Vérifie-les dans le DOM avant de committer — un id qui
 * ne correspond pas donne un dock qui ne s'allume jamais, sans erreur.
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
```

---

## Fichier 5 — `app/(public)/layout.tsx`

Ajoute les trois éléments **au même niveau**, en dehors de `{children}` :

```tsx
import { MotionLayer } from '@/components/public/MotionLayer'
import { MovementDock } from '@/components/public/MovementDock'

// … dans le JSX rendu, autour de <main> :
<div className="progress" aria-hidden="true">
  <span className="progress__bar" />
</div>
<MovementDock />
{children}
<MotionLayer />
```

---

## Fichier 6 — le portrait

Trouve le composant qui rend le portrait aujourd'hui (`rg -l "portrait" components app`)
et remplace son balisage par :

```tsx
<figure className="portrait">
  <Image
    className="portrait__img"
    src="/portrait.webp"
    alt="Suhrago Nelkaël Tolofon"
    width={1046}
    height={1100}
    priority
    sizes="(min-width: 1024px) 460px, 90vw"
  />
</figure>
```

**Trois points à ne pas rater :**

1. `priority` reste : le portrait est l'élément le plus grand du premier écran,
   c'est lui qui porte le LCP.
2. `width`/`height` sont ceux du fichier, pas ceux de l'affichage. Combinés à
   l'`aspect-ratio` de `.portrait`, ils gardent le **décalage de mise en page à zéro** —
   c'est un chiffre qu'on annonce, il ne doit pas bouger.
3. Si un `<link rel="preload">` pointait vers l'ancien portrait, **mets-le à jour**.
   Un preload vers un fichier supprimé est un 404 silencieux qui coûte du temps de
   chargement sans rien précharger.

---

## Tests à passer avant de committer

| # | Test | Attendu |
|---|---|---|
| 1 | Commande A ci-dessous : fichiers dont la **première instruction** est la directive `'use client'` | Exactement : `MotionLayer.tsx`, `ChatPanel.tsx`, `ContactForm.tsx`, `BookingForm.tsx`, `CancelButton.tsx`. Aucun fichier de section ne gagne la directive. Tout fichier en plus = échec. C'est D16/D26. |
| 2 | Charger la page d'accueil, DevTools → Rendering → *Emulate prefers-reduced-motion* | Tout se fige, la page reste entièrement lisible et navigable |
| 3 | `document.documentElement.scrollWidth - document.documentElement.clientWidth` | `0` en 390, 768 et 1280 px |
| 4 | Console pendant un aller-retour complet de défilement | Zéro erreur |
| 5 | Cliquer chaque entrée du dock | La pastille verte glisse, la section correspondante arrive à l'écran |
| 6 | Lighthouse mobile, page d'accueil, **médiane de passages alternés** ancien/nouveau | CLS pas plus haut qu'avant le bloc (0,006 déjà présent, voir `docs/DETTE.md`), performance au plus 3 points sous l'ancienne version |
| 7 | Navigation au clavier seul, `Tab` sur tout le dock | Contour de focus visible partout |
| 8 | Commande B ci-dessous : fichiers dont le **nom** contient « portrait » | Une seule ligne : `public/portrait.webp` |

```bash
# A — la DIRECTIVE, pas le mot. On saute les lignes vides et les commentaires,
# puis on regarde la première instruction du fichier. Un `// "use client" justifié`
# en commentaire ne compte pas : c'est ce qui faussait la première version du test.
find components/sections components/public components/primitives components/booking \
     "app/(public)" -name '*.ts*' -print0 |
  xargs -0 awk 'FNR==1{done=0} done{next}
    /^[[:space:]]*$/ || /^[[:space:]]*(\/\/|\/\*|\*)/ {next}
    { if ($0 ~ /^[[:space:]]*["\047]use client["\047];?[[:space:]]*$/) print FILENAME; done=1 }' | sort

# B — un NOM de fichier, pas un contenu (la première version cherchait le mot
# dans le contenu des fichiers et ne trouvait donc rien dans un .webp).
find public -iname '*portrait*'
```

Si le test 6 régresse, le suspect est le portrait, pas le mouvement : vérifie
d'abord que `preload` et les dimensions sont bien posés.

---

## Prompt à envoyer à Claude Code

```
Lis d'abord docs/16-MOTION-PORTRAIT.md en entier.

Applique les fichiers 2 à 6 dans l'ordre. Le fichier portrait.webp est déjà
déposé dans public/.

Trois règles non négociables :
1. Aucune section publique ne gagne "use client". Un seul composant client :
   MotionLayer.tsx. Si tu te retrouves à en ajouter un deuxième, arrête-toi
   et explique pourquoi avant de continuer.
2. Les id du dock doivent correspondre exactement aux id réellement posés par
   SectionFrame. Vérifie-les dans le DOM rendu, ne les devine pas.
3. TypeScript strict : aucun any, aucun @ts-ignore.

Quand c'est fait, exécute les 8 tests du tableau et donne-moi le résultat de
chacun, y compris ceux qui échouent. Ne corrige pas un test en le contournant.
```
