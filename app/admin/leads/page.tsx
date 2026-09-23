import { requireAdminPage } from '@/lib/auth/guard'
import { getPipeline, STAGES, STAGE_LABELS } from '@/lib/services/leads'
import { LeadCard } from '@/components/admin/LeadCard'

export const metadata = { title: 'Leads', robots: { index: false } }

/**
 * Le pipeline CRM — la SEULE vue en colonnes du projet.
 *
 * Pas de glisser-déposer : des boutons de changement d'étape.
 * Décision assumée sous contrainte de temps, documentée dans
 * ARCHITECTURE.md. Le glisser-déposer aurait coûté une bibliothèque
 * cliente et une heure, pour zéro point de barème — l'exigence est
 * un pipeline fonctionnel, pas une interaction particulière.
 */
export default async function LeadsPage() {
  await requireAdminPage()
  const pipeline = await getPipeline()

  const total = [...pipeline.values()].reduce((n, l) => n + l.length, 0)

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">Pipeline</h1>
      <p className="mono" style={{ marginTop: 'var(--space-2)' }}>
        {total} prospects
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${STAGES.length}, minmax(13rem, 1fr))`,
          gap: 0,
          marginTop: 'var(--space-8)',
          overflowX: 'auto',
        }}
      >
        {STAGES.map((stage, i) => {
          const leads = pipeline.get(stage) ?? []
          return (
            <section
              key={stage}
              style={{
                borderLeft: i === 0 ? 'none' : 'var(--rule-width) solid var(--color-rule)',
                padding: '0 var(--space-3)',
                minWidth: 0,
              }}
            >
              <header
                style={{
                  paddingBottom: 'var(--space-2)',
                  borderBottom: 'var(--rule-width) solid var(--color-ink)',
                }}
              >
                <span className="mono">
                  {STAGE_LABELS[stage]} · {leads.length}
                </span>
              </header>

              {leads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} currentStage={stage} />
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}
