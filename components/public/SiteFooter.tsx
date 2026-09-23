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
