import { SectionFrame } from '@/components/primitives/SectionFrame'
import { ChatPanel } from './ChatPanel'

export function Dialogue({ suggestions }: { suggestions: string[] }) {
  return (
    <SectionFrame
      id="dialogue"
      number="04"
      meta={['Dialogue', 'Assistant IA']}
      anchor="2-9"
      className="enter"
    >
      <div className="section-heading section-heading--compact">
        <div>
          <p className="section-kicker mono">Portfolio interrogeable</p>
          <h2 className="display display--section">L’assistant répond sur mon travail.</h2>
        </div>
        <p className="section-heading__intro">
          Posez une question : il répond uniquement à partir des données du site,
          cite ses sources et refuse quand l’information manque.
        </p>
      </div>

      <ChatPanel suggestions={suggestions} />
    </SectionFrame>
  )
}
