import { STAGES, STAGE_LABELS } from '@/lib/services/leads'
import { moveLeadAction } from '@/app/admin/leads/actions'
import type { LeadStage } from '@prisma/client'

type Lead = {
  id: string
  intent: string
  createdAt: Date
  contact: { name: string; email: string; company: string | null }
}

/** Âge du prospect, en clair : un prospect qui dort se voit. */
function ageLabel(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  return `il y a ${days} j`
}

export function LeadCard({ lead, currentStage }: { lead: Lead; currentStage: LeadStage }) {
  const next = STAGES.filter((s) => s !== currentStage)

  return (
    <article
      style={{
        paddingBlock: 'var(--space-3)',
        borderBottom: 'var(--rule-width) solid var(--color-rule)',
      }}
    >
      <strong style={{ fontSize: 'var(--text-sm)' }}>{lead.contact.name}</strong>
      <div className="mono">{lead.contact.company || lead.contact.email}</div>

      <p
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-ink-muted)',
          marginBlock: 'var(--space-2)',
        }}
      >
        {lead.intent.slice(0, 90)}
        {lead.intent.length > 90 && '…'}
      </p>

      <div className="mono">{ageLabel(lead.createdAt)}</div>

      <form action={moveLeadAction} style={{ marginTop: 'var(--space-2)' }}>
        <input type="hidden" name="id" value={lead.id} />
        <select
          name="stage"
          className="mono"
          defaultValue=""
          style={{ background: 'transparent', border: 0, cursor: 'pointer', width: '100%' }}
        >
          <option value="" disabled>
            Déplacer vers…
          </option>
          {next.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="mono" style={{ background: 'none', border: 0, cursor: 'pointer' }}>
          OK
        </button>
      </form>
    </article>
  )
}
