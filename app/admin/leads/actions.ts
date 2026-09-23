'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { LeadStage } from '@prisma/client'
import { requireAdminApi } from '@/lib/auth/guard'
import { moveLead } from '@/lib/services/leads'

// L'étape vient d'un <select> : une valeur hors enum est rejetée ici, pas
// transmise à Prisma via un cast `as LeadStage` qui mentirait au typage.
const stageSchema = z.enum(LeadStage)

export async function moveLeadAction(formData: FormData) {
  await requireAdminApi()

  const id = String(formData.get('id') ?? '')
  const stage = stageSchema.safeParse(formData.get('stage'))
  if (!id || !stage.success) return

  await moveLead(id, stage.data)
  revalidatePath('/admin/leads')
}

export async function addNoteAction(formData: FormData) {
  const user = await requireAdminApi()

  const leadId = String(formData.get('leadId') ?? '')
  const body = String(formData.get('body') ?? '').trim().slice(0, 2000)
  if (!leadId || body.length < 2) return

  const { prisma } = await import('@/lib/prisma')

  await prisma.$transaction([
    prisma.leadNote.create({ data: { leadId, body, authorId: user.id } }),
    prisma.leadEvent.create({ data: { leadId, type: 'NOTE_ADDED' } }),
    prisma.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } }),
  ])

  revalidatePath('/admin/leads')
}
