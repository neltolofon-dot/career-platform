import Link from 'next/link'
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
export function Works({
  projects,
  domains,
  activeDomain,
}: {
  projects: Project[]
  domains: { name: string; count: number }[]
  activeDomain: string | null
}) {
  const n = projects.length

  return (
    <SectionFrame
      id="travaux"
      number="01"
      meta={['Travaux', ...(activeDomain ? [activeDomain] : []), `${n} ${n > 1 ? 'entrées' : 'entrée'}`]}
      anchor="1-12"
      className="enter"
    >
      <h2 className="display display--section" style={{ marginBottom: 'var(--space-8)' }}>
        Travaux
      </h2>

      {/* Des LIENS, pas des boutons : le filtre vit dans l'URL, s'applique côté
          serveur, se partage et s'indexe. Works reste un Server Component ;
          Link rend un vrai <a href>, fonctionnel même sans JavaScript. */}
      <nav
        aria-label="Filtrer les travaux par domaine"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}
      >
        <Link
          href="/#travaux"
          prefetch={false}
          className="chat-suggestion"
          aria-current={activeDomain ? undefined : 'true'}
        >
          Tous
        </Link>
        {domains.map((d) => (
          <Link
            key={d.name}
            href={`/?domaine=${encodeURIComponent(d.name)}#travaux`}
            prefetch={false}
            className="chat-suggestion"
            aria-current={activeDomain === d.name ? 'true' : undefined}
          >
            {d.name}
          </Link>
        ))}
      </nav>

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
