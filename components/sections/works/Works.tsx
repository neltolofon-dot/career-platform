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
