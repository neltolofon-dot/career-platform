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
