'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminApi } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

/**
 * La réponse est enregistrée en base et visible dans le fil.
 *
 * DETTE ASSUMÉE : aucun e-mail n'est envoyé au visiteur — pas de
 * service d'envoi dans le temps imparti. Documenté dans
 * ARCHITECTURE.md comme limitation connue, pas comme oubli.
 */
export async function replyAction(conversationId: string, formData: FormData) {
  await requireAdminApi()

  const body = String(formData.get('body') ?? '').trim().slice(0, 4000)
  if (body.length < 2) return

  await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, direction: 'OUTBOUND', body },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'ANSWERED', lastMessageAt: new Date() },
    }),
  ])

  revalidatePath(`/admin/messages/${conversationId}`)
  revalidatePath('/admin/messages')
}
