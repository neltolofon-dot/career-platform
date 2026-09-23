# Bloc 3 — Pages publiques : mouvements 00 à 03 + page projet

> C'est le bloc qui vaut les 15 points de design. Il est aussi celui où une IA
> régresse le plus vite vers le générique : relis `docs/03-DESIGN-SYSTEM.md` §8
> (les interdits) avant d'écrire une ligne.

---

## Étape 0 — Migration `focusNow` (teste la procédure)

Le champ manque au modèle `Profile`. Profites-en pour valider la procédure de
migration documentée dans `CLAUDE.md` — mieux vaut la tester maintenant qu'à H20 sous
pression.

```prisma
model Profile {
  // … champs existants
  focusNow  String?   // "Sécurité applicative et architectures de données"
}
```

```bash
npx prisma migrate dev --create-only --name profile_focus_now
# → OUVRIR le migration.sql, SUPPRIMER toute ligne DROP INDEX / ALTER COLUMN
#   touchant knowledge_chunks, appointments, page_views
npx prisma migrate deploy
npm run verify:db     # → doit afficher 4/4
```

---

## Les trois décisions de ce bloc

### D14 — Zéro `dangerouslySetInnerHTML`, même sur son propre contenu

Le markdown des projets est rendu par **`react-markdown`**, qui produit des éléments React
— l'échappement de React s'applique donc nativement. Aucune chaîne HTML n'est injectée.

**Pourquoi c'est mieux que `marked` + DOMPurify :** on n'a rien à assainir, parce qu'on ne
produit jamais de HTML. La surface XSS n'est pas réduite, elle est **absente par
construction**. Et comme le rendu se fait en Server Component, le coût côté client est nul.

**À l'oral :** *« je n'ai aucun `dangerouslySetInnerHTML` dans le projet. Pas un assaini —
aucun. »*

### D15 — Le motif n'est pas la carte, c'est la table

Le sujet interdit « une page composée uniquement de cartes ». L'index des travaux est une
**table typographique**. C'est l'écran qui te distingue en trois secondes, parce qu'aucune
IA ne le produit spontanément.

### D16 — Les Server Components restent des Server Components

Les animations d'entrée sont en CSS scroll-driven. Aucune section publique ne porte
`"use client"`. Conséquence mesurable : **le JavaScript client de la page d'accueil est
quasi nul**, alors que la page est fortement animée.

---

## Fichier 1 — `lib/services/public.ts`

```ts
import { prisma } from '@/lib/prisma'
import { cached } from '@/lib/redis'

/**
 * Lectures publiques, toutes passées par le cache versionné.
 *
 * Une écriture admin incrémente {ENV}:portfolio:version, ce qui rend
 * inatteignables toutes les clés de l'ancienne version d'un coup —
 * aucune clé à lister, aucune à oublier.
 *
 * TTL de 300 s : même sans écriture, le cache se rafraîchit seul,
 * ce qui borne la casse en cas d'invalidation manquée.
 */

export async function getPublicProfile() {
  return cached('profile', 300, async () =>
    prisma.profile.findUnique({
      where: { id: 'profile' },
      select: {
        fullName: true,
        headline: true,
        bio: true,
        location: true,
        timezone: true,
        email: true,
        availability: true,
        focusNow: true,
        openToWork: true,
        socials: true,
      },
    }),
  )
}

export async function getPublicProjects() {
  return cached('projects:published', 300, async () =>
    prisma.project.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        slug: true,
        title: true,
        domain: true,
        role: true,
        year: true,
        stack: true,
        summary: true,
        featured: true,
      },
      // Couvert par @@index([status, featured, order]) — vérifiable
      // par EXPLAIN ANALYZE, cf. PERFORMANCE.md
      orderBy: [{ featured: 'desc' }, { order: 'asc' }, { year: 'desc' }],
    }),
  )
}

export async function getPublicProject(slug: string) {
  return cached(`project:${slug}`, 300, async () =>
    prisma.project.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: {
        slug: true,
        title: true,
        domain: true,
        role: true,
        year: true,
        stack: true,
        summary: true,
        content: true,
        outcomes: true,
        links: true,
      },
    }),
  )
}

export async function getPublicExperiences() {
  return cached('experiences', 300, async () =>
    prisma.experience.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        org: true,
        role: true,
        location: true,
        startDate: true,
        endDate: true,
        current: true,
        summary: true,
        highlights: true,
      },
      orderBy: [{ order: 'asc' }, { startDate: 'desc' }],
    }),
  )
}

/**
 * Regroupées par catégorie côté serveur : le composant reçoit une
 * structure prête à afficher et n'a aucune logique.
 */
export async function getPublicSkillsByCategory() {
  const skills = await cached('skills', 300, async () =>
    prisma.skill.findMany({
      select: { name: true, category: true, context: true },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    }),
  )

  const grouped = new Map<string, { name: string; context: string | null }[]>()
  for (const s of skills) {
    const list = grouped.get(s.category) ?? []
    list.push({ name: s.name, context: s.context })
    grouped.set(s.category, list)
  }

  return Array.from(grouped, ([category, items]) => ({ category, items }))
}
```

---

## Fichier 2 — `components/primitives/RevealLines.tsx`

```tsx
/**
 * Primitive de motion M1 : révélation typographique masquée.
 *
 * Chaque ligne est enveloppée dans un conteneur overflow:hidden ; la
 * ligne monte depuis sous le masque, avec un décalage de 60 ms par ligne.
 *
 * Entièrement CSS (cf. .reveal-line dans globals.css) : ce composant
 * reste un Server Component, zéro JavaScript client.
 */
export function RevealLines({
  text,
  className = '',
}: {
  text: string
  className?: string
}) {
  const lines = text.split('\n').filter(Boolean)

  return (
    <span className={className}>
      {lines.map((line, i) => (
        <span className="reveal-line" key={line}>
          <span style={{ '--i': i } as React.CSSProperties}>{line}</span>
        </span>
      ))}
    </span>
  )
}
```

---

## Fichier 3 — `components/public/SiteNav.tsx`

```tsx
import Link from 'next/link'

/**
 * Pas de menu de navigation classique.
 *
 * Une barre fine avec les numéros de section — c'est un document, pas
 * une application. Le nom en mono à gauche, les ancres numérotées à droite.
 * Aucun logo, aucune icône, aucun bouton d'appel à l'action.
 */
const SECTIONS = [
  { id: 'ouverture', n: '00' },
  { id: 'travaux', n: '01' },
  { id: 'trajectoire', n: '02' },
  { id: 'terrain', n: '03' },
  { id: 'dialogue', n: '04' },
  { id: 'contact', n: '05' },
] as const

export function SiteNav({ name }: { name: string }) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'var(--space-3) var(--gutter)',
        borderBottom: 'var(--rule-width) solid var(--color-rule)',
        background: 'var(--color-paper)',
      }}
    >
      <Link href="/" className="mono" style={{ textDecoration: 'none' }}>
        {name}
      </Link>

      <nav aria-label="Sections" style={{ display: 'flex', gap: 'var(--space-4)' }}>
        {SECTIONS.map(({ id, n }) => (
          <a key={id} href={`#${id}`} className="mono" style={{ textDecoration: 'none' }}>
            {n}
          </a>
        ))}
      </nav>
    </header>
  )
}
```

---

## Fichier 4 — `components/sections/opening/Opening.tsx`

```tsx
import { SectionFrame } from '@/components/primitives/SectionFrame'
import { RevealLines } from '@/components/primitives/RevealLines'
import { OpeningMeta } from './OpeningMeta'

type OpeningProps = {
  headline: string
  availability: string
  location: string
  focusNow: string | null
  projectCount: number
}

/**
 * Mouvement 00 — OUVERTURE.
 *
 * Une déclaration typographique, un filet, une ligne de métadonnées
 * VIVANTES lues en base.
 *
 * Pas de photo, pas de « Hello I'm », pas de bouton « Télécharger mon CV ».
 * Les métadonnées sont la première preuve que le site est branché sur une
 * base de données et pilotable depuis /admin.
 */
export function Opening({
  headline,
  availability,
  location,
  focusNow,
  projectCount,
}: OpeningProps) {
  return (
    <SectionFrame
      id="ouverture"
      number="00"
      meta={['Ouverture', `${projectCount} projets`]}
      anchor="1-11"
      className="enter"
    >
      <h1 className="display display--statement">
        <RevealLines text={headline} />
      </h1>

      <hr className="rule" style={{ margin: 'var(--space-12) 0 var(--space-6)' }} />

      <OpeningMeta availability={availability} location={location} focusNow={focusNow} />
    </SectionFrame>
  )
}
```

## Fichier 5 — `components/sections/opening/OpeningMeta.tsx`

```tsx
import { Mono } from '@/components/primitives/Mono'

/**
 * La ligne de métadonnées vivantes — signature du mouvement 00.
 *
 * Chaque valeur vient de la table Profile et se modifie depuis /admin
 * sans toucher au code, ce qui est exactement l'exigence du sujet.
 */
export function OpeningMeta({
  availability,
  location,
  focusNow,
}: {
  availability: string
  location: string
  focusNow: string | null
}) {
  const items = [availability, location, focusNow ? `Focus : ${focusNow}` : null].filter(
    Boolean,
  ) as string[]

  return (
    <dl
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-2) var(--space-6)',
        margin: 0,
      }}
    >
      {items.map((item, i) => (
        <div key={item} style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {i > 0 && <span className="mono" aria-hidden="true">·</span>}
          <Mono as="dd">{item}</Mono>
        </div>
      ))}
    </dl>
  )
}
```

---

## Fichier 6 — `components/sections/works/Works.tsx` ⭐

```tsx
import { SectionFrame } from '@/components/primitives/SectionFrame'
import { WorksRow } from './WorksRow'

type Project = {
  slug: string
  title: string
  domain: string
  role: string
  year: number
  stack: string[]
  summary: string
}

/**
 * Mouvement 01 — TRAVAUX.
 *
 * ┌────────────────────────────────────────────────────────────────────┐
 * │  UNE TABLE, PAS DES CARTES.                                        │
 * │                                                                    │
 * │  Le sujet interdit explicitement « une page composée uniquement    │
 * │  de cartes ». C'est l'écran le plus différenciant du site : aucune │
 * │  IA ne produit spontanément un index typographique.                │
 * │                                                                    │
 * │  Une table est aussi la bonne SÉMANTIQUE : des données tabulaires  │
 * │  comparables sur des colonnes homogènes. Les lecteurs d'écran      │
 * │  annoncent les en-têtes, ce qu'une grille de div ne fait pas.      │
 * └────────────────────────────────────────────────────────────────────┘
 */
export function Works({ projects }: { projects: Project[] }) {
  return (
    <SectionFrame
      id="travaux"
      number="01"
      meta={['Travaux', `${projects.length} entrées`]}
      anchor="1-12"
      className="enter"
    >
      <h2 className="display display--section" style={{ marginBottom: 'var(--space-8)' }}>
        Travaux
      </h2>

      <table className="index-table">
        <caption className="sr-only">
          Index des projets : année, titre, domaine, rôle et technologies
        </caption>
        <thead>
          <tr>
            <th scope="col">Année</th>
            <th scope="col">Projet</th>
            <th scope="col">Domaine</th>
            <th scope="col">Rôle</th>
            <th scope="col">Stack</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <WorksRow key={p.slug} project={p} />
          ))}
        </tbody>
      </table>
    </SectionFrame>
  )
}
```

## Fichier 7 — `components/sections/works/WorksRow.tsx`

```tsx
import Link from 'next/link'

type Project = {
  slug: string
  title: string
  domain: string
  role: string
  year: number
  stack: string[]
  summary: string
}

/**
 * Une ligne de l'index.
 *
 * Le lien enveloppe le TITRE et non la ligne entière : un <a> autour d'un
 * <tr> est invalide en HTML, et un gestionnaire de clic sur la ligne
 * casserait la navigation clavier, le clic milieu et l'ouverture dans un
 * nouvel onglet. Le survol de la ligne est purement CSS (.index-row:hover).
 *
 * view-transition-name prépare la persistance du titre entre l'index et
 * la page projet (primitive M2).
 */
export function WorksRow({ project }: { project: Project }) {
  return (
    <tr className="index-row">
      <td className="index-row__year">{project.year}</td>

      <td>
        <Link
          href={`/travaux/${project.slug}`}
          className="index-row__title"
          style={{
            textDecoration: 'none',
            viewTransitionName: `project-${project.slug}`,
          }}
        >
          {project.title}
        </Link>
        <p
          className="prose-body"
          style={{
            marginTop: 'var(--space-2)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-ink-muted)',
          }}
        >
          {project.summary}
        </p>
      </td>

      <td className="index-row__stack">{project.domain}</td>
      <td className="index-row__stack">{project.role}</td>
      <td className="index-row__stack">{project.stack.join(' · ')}</td>
    </tr>
  )
}
```

---

## Fichier 8 — `components/sections/trajectory/Trajectory.tsx`

```tsx
import { SectionFrame } from '@/components/primitives/SectionFrame'
import { TrajectoryEntry } from './TrajectoryEntry'

type Experience = {
  org: string
  role: string
  location: string | null
  startDate: Date
  endDate: Date | null
  current: boolean
  summary: string
  highlights: string[]
}

/**
 * Mouvement 02 — TRAJECTOIRE.
 *
 * Chronologie en deux colonnes, séparées par un filet vertical qui fait
 * office d'axe. Pas de « timeline » à pastilles rondes et connecteurs
 * arrondis : le filet 1px suffit à porter la continuité.
 */
export function Trajectory({ experiences }: { experiences: Experience[] }) {
  const years = experiences.map((e) => e.startDate.getFullYear())
  const span = years.length ? `${Math.min(...years)} — aujourd'hui` : ''

  return (
    <SectionFrame
      id="trajectoire"
      number="02"
      meta={['Trajectoire', span, `${experiences.length} entrées`].filter(Boolean)}
      anchor="3-10"
      className="enter"
    >
      <h2 className="display display--section" style={{ marginBottom: 'var(--space-8)' }}>
        Trajectoire
      </h2>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {experiences.map((exp) => (
          <TrajectoryEntry key={`${exp.org}-${exp.role}`} experience={exp} />
        ))}
      </ol>
    </SectionFrame>
  )
}
```

## Fichier 9 — `components/sections/trajectory/TrajectoryEntry.tsx`

```tsx
import { Mono } from '@/components/primitives/Mono'

type Experience = {
  org: string
  role: string
  location: string | null
  startDate: Date
  endDate: Date | null
  current: boolean
  summary: string
  highlights: string[]
}

const fmt = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'short' })

export function TrajectoryEntry({ experience }: { experience: Experience }) {
  const start = fmt.format(experience.startDate)
  const end = experience.current
    ? "aujourd'hui"
    : experience.endDate
      ? fmt.format(experience.endDate)
      : ''

  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(7rem, 9rem) 1fr',
        gap: 'var(--space-6)',
        paddingBlock: 'var(--space-8)',
        borderTop: 'var(--rule-width) solid var(--color-rule)',
      }}
    >
      <div>
        <Mono>
          {start} — {end}
        </Mono>
        {experience.location && (
          <div style={{ marginTop: 'var(--space-1)' }}>
            <Mono>{experience.location}</Mono>
          </div>
        )}
      </div>

      <div>
        <h3 style={{ fontSize: 'var(--text-xl)', lineHeight: 'var(--leading-tight)' }}>
          {experience.role}
        </h3>
        <div style={{ marginTop: 'var(--space-1)' }}>
          <Mono data>{experience.org}</Mono>
        </div>

        {experience.summary && (
          <p className="prose-body" style={{ marginTop: 'var(--space-4)' }}>
            {experience.summary}
          </p>
        )}

        {experience.highlights.length > 0 && (
          <ul
            style={{
              marginTop: 'var(--space-4)',
              paddingLeft: 0,
              listStyle: 'none',
              maxWidth: 'var(--measure)',
            }}
          >
            {experience.highlights.map((h) => (
              <li
                key={h}
                style={{
                  paddingLeft: 'var(--space-4)',
                  borderLeft: 'var(--rule-width) solid var(--color-rule)',
                  marginBottom: 'var(--space-2)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                {h}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}
```

---

## Fichier 10 — `components/sections/ground/Ground.tsx`

```tsx
import { SectionFrame } from '@/components/primitives/SectionFrame'
import { Mono } from '@/components/primitives/Mono'

type Group = { category: string; items: { name: string; context: string | null }[] }

/**
 * Mouvement 03 — TERRAIN.
 *
 * ┌────────────────────────────────────────────────────────────────────┐
 * │  AUCUNE BARRE DE PROGRESSION. AUCUN POURCENTAGE.                   │
 * │                                                                    │
 * │  « React 85 % » ne veut rien dire : personne ne sait ce que        │
 * │  mesurent les 15 % manquants, et c'est le marqueur numéro un du    │
 * │  portfolio de débutant.                                            │
 * │                                                                    │
 * │  On affiche le CONTEXTE D'USAGE RÉEL — « CSP stricte sur           │
 * │  THM Roadmap » — qui est vérifiable par n'importe qui en trente    │
 * │  secondes. Un fait vérifiable vaut dix jauges.                     │
 * └────────────────────────────────────────────────────────────────────┘
 */
export function Ground({ groups }: { groups: Group[] }) {
  const total = groups.reduce((n, g) => n + g.items.length, 0)

  return (
    <SectionFrame
      id="terrain"
      number="03"
      meta={['Terrain', `${total} entrées`]}
      anchor="4-12"
      className="enter"
    >
      <h2 className="display display--section" style={{ marginBottom: 'var(--space-8)' }}>
        Terrain
      </h2>

      {groups.map(({ category, items }) => (
        <section key={category} style={{ marginBottom: 'var(--space-12)' }}>
          <Mono>{category}</Mono>
          <hr className="rule" style={{ margin: 'var(--space-3) 0 var(--space-4)' }} />

          <dl style={{ margin: 0 }}>
            {items.map(({ name, context }) => (
              <div
                key={name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(10rem, 14rem) 1fr',
                  gap: 'var(--space-4)',
                  paddingBlock: 'var(--space-3)',
                  borderBottom: 'var(--rule-width) solid var(--color-rule)',
                }}
              >
                <dt style={{ fontSize: 'var(--text-base)' }}>{name}</dt>
                <dd
                  style={{
                    margin: 0,
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-ink-muted)',
                  }}
                >
                  {context || '—'}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </SectionFrame>
  )
}
```

---

## Fichier 11 — `components/public/SiteFooter.tsx`

```tsx
import { Mono } from '@/components/primitives/Mono'

export function SiteFooter({
  name,
  email,
  socials,
}: {
  name: string
  email: string
  socials: Record<string, string>
}) {
  return (
    <footer
      style={{
        borderTop: 'var(--rule-width) solid var(--color-rule)',
        padding: 'var(--space-8) var(--gutter)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-6)',
        justifyContent: 'space-between',
      }}
    >
      <Mono>
        {name} · {new Date().getFullYear()}
      </Mono>

      <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
        <a href={`mailto:${email}`} className="mono">
          {email}
        </a>
        {Object.entries(socials).map(([key, url]) =>
          url ? (
            <a key={key} href={url} className="mono" rel="me noopener">
              {key}
            </a>
          ) : null,
        )}
      </div>
    </footer>
  )
}
```

---

## Fichier 12 — `app/(public)/layout.tsx`

```tsx
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
```

---

## Fichier 13 — `app/(public)/page.tsx`

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getPublicProfile,
  getPublicProjects,
  getPublicExperiences,
  getPublicSkillsByCategory,
} from '@/lib/services/public'
import { Opening } from '@/components/sections/opening/Opening'
import { Works } from '@/components/sections/works/Works'
import { Trajectory } from '@/components/sections/trajectory/Trajectory'
import { Ground } from '@/components/sections/ground/Ground'

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getPublicProfile()
  if (!profile) return { title: 'Portfolio' }

  // La déclaration contient un saut de ligne pour la mise en page :
  // on le remplace pour les métadonnées et les moteurs de recherche.
  const description = profile.headline.replace(/\n/g, ' ')

  return {
    title: `${profile.fullName} — Développeur full-stack & sécurité`,
    description,
    openGraph: { title: profile.fullName, description, type: 'profile' },
  }
}

/**
 * Page d'accueil — Server Component.
 *
 * Les quatre lectures partent en PARALLÈLE : elles sont indépendantes, et
 * les enchaîner en séquence ajouterait trois aller-retours inutiles au
 * temps de réponse (chacune touche Redis avant Postgres).
 *
 * Aucun sous-composant n'est un Client Component : les animations
 * d'entrée sont en CSS scroll-driven (classe .enter), donc la page
 * n'embarque pratiquement aucun JavaScript.
 */
export default async function HomePage() {
  const [profile, projects, experiences, skillGroups] = await Promise.all([
    getPublicProfile(),
    getPublicProjects(),
    getPublicExperiences(),
    getPublicSkillsByCategory(),
  ])

  if (!profile) notFound()

  return (
    <main>
      <Opening
        headline={profile.headline}
        availability={profile.availability}
        location={profile.location}
        focusNow={profile.focusNow}
        projectCount={projects.length}
      />
      <Works projects={projects} />
      <Trajectory experiences={experiences} />
      <Ground groups={skillGroups} />
      {/* 04 DIALOGUE et 05 CONTACT : blocs suivants */}
    </main>
  )
}
```

---

## Fichier 14 — `components/public/Markdown.tsx`

```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Rendu markdown SANS dangerouslySetInnerHTML.
 *
 * react-markdown produit des ÉLÉMENTS REACT, pas une chaîne HTML :
 * l'échappement de React s'applique nativement. Il n'y a rien à
 * assainir parce qu'on ne produit jamais de HTML.
 *
 * Volontairement PAS de rehype-raw : autoriser le HTML brut dans le
 * markdown rouvrirait exactement la surface qu'on vient de fermer.
 *
 * Server Component : le coût de la bibliothèque est entièrement côté
 * serveur, zéro octet envoyé au navigateur.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: (props) => (
            <h2
              className="display"
              style={{
                fontSize: 'var(--text-xl)',
                marginTop: 'var(--space-12)',
                marginBottom: 'var(--space-3)',
              }}
              {...props}
            />
          ),
          h3: (props) => (
            <h3
              style={{
                fontSize: 'var(--text-lg)',
                marginTop: 'var(--space-8)',
                marginBottom: 'var(--space-2)',
              }}
              {...props}
            />
          ),
          p: (props) => <p style={{ marginBottom: 'var(--space-4)' }} {...props} />,
          ul: (props) => (
            <ul style={{ paddingLeft: 'var(--space-6)', marginBottom: 'var(--space-4)' }} {...props} />
          ),
          code: (props) => (
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9em',
                background: 'var(--color-surface)',
                padding: '0.1em 0.35em',
              }}
              {...props}
            />
          ),
          // Tout lien externe part en rel="noopener" : sans lui, la page
          // ouverte peut manipuler window.opener (tabnabbing).
          a: ({ href, ...props }) => (
            <a href={href} rel="noopener noreferrer" target="_blank" {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
```

---

## Fichier 15 — `app/(public)/travaux/[slug]/page.tsx`

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublicProject, getPublicProjects } from '@/lib/services/public'
import { SectionFrame } from '@/components/primitives/SectionFrame'
import { Mono } from '@/components/primitives/Mono'
import { Markdown } from '@/components/public/Markdown'

type Params = { params: Promise<{ slug: string }> }

/**
 * Génération statique des pages projet au build.
 * Le contenu change rarement ; revalidatePath('/') est déjà appelé à
 * chaque écriture admin, donc la fraîcheur est garantie sans rendu
 * à la demande.
 */
export async function generateStaticParams() {
  const projects = await getPublicProjects()
  return projects.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const project = await getPublicProject(slug)
  if (!project) return {}

  return {
    title: `${project.title} — ${project.domain}`,
    description: project.summary,
  }
}

export default async function ProjectPage({ params }: Params) {
  const { slug } = await params
  const project = await getPublicProject(slug)

  if (!project) notFound()

  const links = (project.links ?? {}) as { live?: string; repo?: string }

  return (
    <main>
      <SectionFrame
        number={String(project.year)}
        meta={[project.domain, project.role]}
        anchor="3-10"
      >
        {/* Même view-transition-name que dans l'index : le titre persiste
            physiquement pendant la navigation (primitive M2). */}
        <h1
          className="display display--page"
          style={{ viewTransitionName: `project-${project.slug}` }}
        >
          {project.title}
        </h1>

        <p
          className="prose-body"
          style={{ marginTop: 'var(--space-6)', fontSize: 'var(--text-lg)' }}
        >
          {project.summary}
        </p>

        <hr className="rule" style={{ margin: 'var(--space-8) 0' }} />

        <dl
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-6)',
            margin: '0 0 var(--space-8)',
          }}
        >
          <div>
            <Mono>Stack</Mono>
            <dd style={{ margin: 0 }}>
              <Mono data>{project.stack.join(' · ')}</Mono>
            </dd>
          </div>
          {links.live && (
            <div>
              <Mono>En ligne</Mono>
              <dd style={{ margin: 0 }}>
                <a href={links.live} className="mono mono--data" rel="noopener noreferrer" target="_blank">
                  {new URL(links.live).hostname}
                </a>
              </dd>
            </div>
          )}
          {links.repo && (
            <div>
              <Mono>Code</Mono>
              <dd style={{ margin: 0 }}>
                <a href={links.repo} className="mono mono--data" rel="noopener noreferrer" target="_blank">
                  Dépôt
                </a>
              </dd>
            </div>
          )}
        </dl>

        {project.outcomes.length > 0 && (
          <>
            <Mono>Résultats</Mono>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 'var(--space-3) 0 var(--space-8)',
                maxWidth: 'var(--measure)',
              }}
            >
              {project.outcomes.map((o) => (
                <li
                  key={o}
                  style={{
                    paddingLeft: 'var(--space-4)',
                    borderLeft: '2px solid var(--color-vermilion)',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  {o}
                </li>
              ))}
            </ul>
          </>
        )}

        {project.content && <Markdown>{project.content}</Markdown>}

        <hr className="rule" style={{ margin: 'var(--space-12) 0 var(--space-6)' }} />
        <Link href="/#travaux" className="mono">
          ← Retour à l'index
        </Link>
      </SectionFrame>
    </main>
  )
}
```

---

## Fichier 16 — `app/(public)/travaux/[slug]/not-found.tsx`

```tsx
import Link from 'next/link'
import { SectionFrame } from '@/components/primitives/SectionFrame'

export default function ProjectNotFound() {
  return (
    <main>
      <SectionFrame number="404" meta={['Introuvable']} anchor="3-10">
        <h1 className="display display--section">Ce projet n'existe pas</h1>
        <p className="prose-body" style={{ marginTop: 'var(--space-4)' }}>
          Le lien est peut-être périmé, ou le projet n'est plus publié.
        </p>
        <hr className="rule" style={{ margin: 'var(--space-8) 0 var(--space-4)' }} />
        <Link href="/#travaux" className="mono">
          ← Voir tous les travaux
        </Link>
      </SectionFrame>
    </main>
  )
}
```

---

## Dépendances

```bash
npm i react-markdown remark-gfm
```

---

## Tests à passer

```bash
URL="https://career-platform-pied.vercel.app"

# 1. Page d'accueil → 200, et les 6 projets présents
curl -s "$URL" | grep -c "index-row"          # → 6

# 2. Page projet → 200
curl -s -o /dev/null -w "%{http_code}\n" "$URL/travaux/koto-cosmetique"

# 3. Slug inexistant → 404
curl -s -o /dev/null -w "%{http_code}\n" "$URL/travaux/nexistepas"

# 4. Aucun dangerouslySetInnerHTML dans tout le projet
grep -rn "dangerouslySetInnerHTML" app/ components/ lib/    # → vide

# 5. Aucune section publique en Client Component
grep -rln "use client" components/sections/                 # → vide

# 6. Lighthouse
npx lighthouse "$URL" --output=json --quiet | \
  jq '.categories | to_entries[] | "\(.key): \(.value.score * 100)"'
```

---

## Prompt pour Claude Code

```
Lis CLAUDE.md, docs/03-DESIGN-SYSTEM.md (en entier, surtout §5 et §8)
et docs/10-PAGES-PUBLIQUES.md.

═══ 0. MIGRATION ═══
Ajoute focusNow String? au modèle Profile, puis applique la PROCÉDURE
OBLIGATOIRE de CLAUDE.md (migrate dev --create-only, relecture du SQL,
suppression des DROP INDEX, migrate deploy, npm run verify:db → 4/4).
Puis reseed pour que la valeur de content.ts soit prise en compte.

═══ 1. CODE ═══
npm i react-markdown remark-gfm
Crée les 16 fichiers exactement comme spécifiés, tous les commentaires
conservés.

Déplace app/page.tsx existant vers app/(public)/page.tsx. Vérifie que le
groupe de routes (public) n'entre pas en conflit avec /admin ni /login.

═══ 2. VÉRIFICATIONS DE DESIGN ═══
Relis docs/03-DESIGN-SYSTEM.md §8 et confirme-moi, point par point,
qu'AUCUN interdit n'est violé dans le code produit :
border-radius, box-shadow, gradient, emoji, section en cartes, barre de
progression, dark mode, bibliothèque d'animation JS, plus d'un accent
coloré par écran.

Confirme aussi :
- aucun composant au-dessus de 150 lignes
- aucun "use client" dans components/sections/
- aucun dangerouslySetInnerHTML nulle part

═══ 3. TESTS ═══
tsc --noEmit, npm run build, déploie, et rejoue les 6 tests de la
section "Tests à passer". Sortie brute.

Prends une capture pleine page de l'accueil et d'une page projet en
1600px avec Playwright, dans assets/raw/site-accueil.png et
assets/raw/site-projet.png, et décris-moi ce que tu vois — je veux
savoir si le rendu correspond à la direction artistique avant de le
regarder moi-même.

Commit : "feat: pages publiques, mouvements 00 à 03 et page projet"
```
