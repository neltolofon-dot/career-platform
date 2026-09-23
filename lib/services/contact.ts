import { prisma } from '@/lib/prisma'
import { parseOrThrow } from './_shared'
import { contactSchema } from '@/lib/validation/contact'
import { bumpEvents } from '@/lib/redis'

/**
 * Traitement d'un contact entrant.
 *
 * Toute la chaîne — personne, conversation, message, prospect, audit,
 * notification — s'exécute dans UNE transaction. Un état partiel
 * (un message sans prospect, un prospect sans conversation) serait
 * invisible et non rattrapable.
 */
export async function submitContact(raw: unknown) {
  const data = parseOrThrow(contactSchema, raw)

  // Piège à robots : on répond comme si tout allait bien, sans écrire.
  // Retourner une erreur apprendrait au robot à contourner le champ.
  if (data.website) {
    return { ok: true as const, spam: true as const }
  }

  await prisma.$transaction(async (tx) => {
    // Le Contact est le PIVOT : identifié par son email, il existe une
    // seule fois quelle que soit la façon dont la personne revient
    // (formulaire, réservation, chatbot).
    const contact = await tx.contact.upsert({
      where: { email: data.email },
      update: {
        name: data.name,
        ...(data.company ? { company: data.company } : {}),
      },
      create: {
        email: data.email,
        name: data.name,
        company: data.company || null,
        firstSource: 'CONTACT_FORM',
      },
    })

    const subject = data.message.slice(0, 60).trim() + (data.message.length > 60 ? '…' : '')

    const conversation = await tx.conversation.create({
      data: {
        contactId: contact.id,
        subject,
        status: 'OPEN',
        // Compteur dénormalisé : la liste admin affiche les non-lus
        // sans lancer un COUNT par ligne. Maintenu ici, dans la même
        // transaction que l'insertion du message.
        unreadCount: 1,
        lastMessageAt: new Date(),
      },
    })

    await tx.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        body: data.message,
      },
    })

    const lead = await tx.lead.create({
      data: {
        contactId: contact.id,
        stage: 'NEW',
        source: 'CONTACT_FORM',
        intent: data.message.slice(0, 500),
      },
    })

    // Journal d'audit immuable : écrit dans la MÊME transaction que
    // le prospect. Un audit qui peut diverger de l'état n'a aucune valeur.
    await tx.leadEvent.create({
      data: {
        leadId: lead.id,
        type: 'LEAD_CREATED',
        toStage: 'NEW',
        payload: { source: 'CONTACT_FORM' },
      },
    })

    await tx.notification.create({
      data: {
        type: 'NEW_LEAD',
        title: `Nouveau contact — ${contact.name}`,
        body: subject,
        entityType: 'conversation',
        entityId: conversation.id,
      },
    })
  })

  // Hors transaction : le compteur Redis n'est pas transactionnel, et
  // un échec de bump ne doit pas annuler un contact réel.
  await bumpEvents().catch(() => {})

  return { ok: true as const, spam: false as const }
}
