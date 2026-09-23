import { SectionFrame } from '@/components/primitives/SectionFrame'
import { ChatPanel } from './ChatPanel'

/**
 * Mouvement 04 — DIALOGUE.
 *
 * ┌────────────────────────────────────────────────────────────────────┐
 * │  PAS DE BULLE FLOTTANTE EN BAS À DROITE.                           │
 * │                                                                    │
 * │  C'est le cliché absolu, et il enterre sous un widget que personne │
 * │  ne clique le module qui vaut le plus de points.                   │
 * │                                                                    │
 * │  Le chatbot est une SECTION à part entière du parcours de lecture. │
 * └────────────────────────────────────────────────────────────────────┘
 */
export function Dialogue({ suggestions }: { suggestions: string[] }) {
  return (
    <SectionFrame
      id="dialogue"
      number="04"
      meta={['Dialogue', 'Assistant IA']}
      anchor="2-9"
      className="enter"
    >
      <h2 className="display display--section">L’assistant répond sur mon travail</h2>

      <p className="prose-body" style={{ marginTop: 'var(--space-4)' }}>
        Posez-lui une question. Il ne répond qu’à partir des données de ce
        site, cite ses sources, et refuse quand l’information n’y est pas.
      </p>

      <ChatPanel suggestions={suggestions} />
    </SectionFrame>
  )
}
