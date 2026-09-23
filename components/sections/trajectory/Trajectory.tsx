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
