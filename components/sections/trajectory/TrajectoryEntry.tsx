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
    <li className="trajectory-entry">
      <div className="trajectory-entry__meta">
        <Mono>{start} — {end}</Mono>
        {experience.location && <Mono>{experience.location}</Mono>}
      </div>

      <div className="trajectory-entry__content">
        <h3 className="trajectory-entry__title display">{experience.role}</h3>
        <Mono data>{experience.org}</Mono>

        {experience.summary && (
          <p className="prose-body trajectory-entry__summary">{experience.summary}</p>
        )}

        {experience.highlights.length > 0 && (
          <ul className="trajectory-entry__highlights">
            {experience.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
          </ul>
        )}
      </div>
    </li>
  )
}
