import { prisma } from '@/lib/prisma'
import type { LeadStage } from '@prisma/client'

export const STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'DISCUSSION', 'PROPOSAL', 'WON', 'LOST']

export const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: 'Nouveau',
  CONTACTED: 'Contacté',
  DISCUSSION: 'Discussion',
  PROPOSAL: 'Proposition',
  WON: 'Gagné',
  LOST: 'Perdu',
}

/**
 * Le pipeline entier en UNE requête, groupée côté serveur.
 *
 * L'alternative — six requêtes, une par colonne — coûterait six
 * aller-retours pour afficher un seul écran.
 */
export async function getPipeline() {
  const leads = await prisma.lead.findMany({
    where: { stage: { notIn: [] } },
    select: {
      id: true,
      stage: true,
      intent: true,
      createdAt: true,
      lastActivityAt: true,
      contact: { select: { name: true, email: true, company: true } },
    },
    orderBy: [{ stage: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  })

  const byStage = new Map<LeadStage, typeof leads>()
  for (const s of STAGES) byStage.set(s, [])
  for (const l of leads) byStage.get(l.stage)?.push(l)

  return byStage
}

/**
 * Changement d'étape + écriture du journal d'audit, dans la MÊME
 * transaction. C'est ce qui permet de répondre à « quand ce prospect
 * est-il passé en PROPOSAL, et par quel chemin ».
 */
export async function moveLead(leadId: string, toStage: LeadStage) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
      select: { stage: true },
    })
    if (!lead) throw new Error('Lead introuvable')

    const updated = await tx.lead.update({
      where: { id: leadId },
      data: {
        stage: toStage,
        lastActivityAt: new Date(),
        ...(toStage === 'WON' || toStage === 'LOST' ? { closedAt: new Date() } : { closedAt: null }),
      },
    })

    await tx.leadEvent.create({
      data: {
        leadId,
        type: 'STAGE_CHANGED',
        fromStage: lead.stage,
        toStage,
      },
    })

    return updated
  })
}

export async function getLeadDetail(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      contact: true,
      notes: { orderBy: { createdAt: 'desc' }, take: 50 },
      events: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  })
}
