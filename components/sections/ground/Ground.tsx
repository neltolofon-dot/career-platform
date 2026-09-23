import { SectionFrame } from '@/components/primitives/SectionFrame'
import { Mono } from '@/components/primitives/Mono'

type Group = { category: string; items: { name: string; context: string | null }[] }

export function Ground({ groups }: { groups: Group[] }) {
  const total = groups.reduce((count, group) => count + group.items.length, 0)

  return (
    <SectionFrame
      id="terrain"
      number="03"
      meta={['Terrain', `${total} entrées`]}
      anchor="4-12"
      className="enter"
    >
      <div className="section-heading section-heading--compact">
        <div>
          <p className="section-kicker mono">Expertise appliquée</p>
          <h2 className="display display--section">Ce que je sais mettre en production.</h2>
        </div>
        <p className="section-heading__intro">
          Pas de pourcentages abstraits : des outils reliés à des usages et à des projets vérifiables.
        </p>
      </div>

      <div className="ground-grid">
        {groups.map(({ category, items }) => (
          <section className="ground-group" key={category}>
            <Mono>{category}</Mono>
            <dl>
              {items.map(({ name, context }) => (
                <div className="ground-item" key={name}>
                  <dt>{name}</dt>
                  <dd>{context || '—'}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </SectionFrame>
  )
}
