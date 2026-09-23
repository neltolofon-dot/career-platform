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

export function Trajectory({ experiences }: { experiences: Experience[] }) {
  const years = experiences.map((experience) => experience.startDate.getFullYear())
  const span = years.length ? `${Math.min(...years)} — aujourd'hui` : ''

  return (
    <SectionFrame
      id="trajectoire"
      number="02"
      meta={['Trajectoire', span, `${experiences.length} entrées`].filter(Boolean)}
      anchor="3-10"
      className="enter"
    >
      <div className="section-heading section-heading--compact">
        <div>
          <p className="section-kicker mono">Depuis 2021</p>
          <h2 className="display display--section">Une trajectoire construite sur le terrain.</h2>
        </div>
        <p className="section-heading__intro">
          Du support informatique au développement full-stack, avec la sécurité comme fil conducteur.
        </p>
      </div>

      <ol className="trajectory-list">
        {experiences.map((experience) => (
          <TrajectoryEntry key={`${experience.org}-${experience.role}`} experience={experience} />
        ))}
      </ol>
    </SectionFrame>
  )
}
