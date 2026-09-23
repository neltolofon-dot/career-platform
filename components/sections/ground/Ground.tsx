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
