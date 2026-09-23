import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { replyAction } from '../actions'

export const metadata = { title: 'Conversation', robots: { index: false } }

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage()
  const { id } = await params

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!conversation) notFound()

  // Ouvrir la conversation la marque comme lue. Dans le même passage,
  // on solde les notifications qui la concernaient.
  if (conversation.unreadCount > 0) {
    await prisma.$transaction([
      prisma.conversation.update({ where: { id }, data: { unreadCount: 0 } }),
      prisma.message.updateMany({
        where: { conversationId: id, readAt: null, direction: 'INBOUND' },
        data: { readAt: new Date() },
      }),
      prisma.notification.updateMany({
        where: { entityType: 'conversation', entityId: id, readAt: null },
        data: { readAt: new Date() },
      }),
    ])
  }

  const reply = replyAction.bind(null, id)

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '48rem' }}>
      <h1 className="display display--section">{conversation.subject}</h1>
      <p className="mono" style={{ marginTop: 'var(--space-2)' }}>
        {conversation.contact.name} · {conversation.contact.email}
        {conversation.contact.company && ` · ${conversation.contact.company}`}
      </p>

      <div style={{ marginTop: 'var(--space-8)' }}>
        {conversation.messages.map((m) => (
          <div
            key={m.id}
            style={{
              paddingBlock: 'var(--space-4)',
              borderTop: 'var(--rule-width) solid var(--color-rule)',
              paddingLeft: m.direction === 'OUTBOUND' ? 'var(--space-8)' : 0,
            }}
          >
            <span className="mono">
              {m.direction === 'INBOUND' ? conversation.contact.name : 'Vous'} ·{' '}
              {m.createdAt.toLocaleString('fr-FR')}
            </span>
            {/* Contenu utilisateur rendu comme TEXTE par React :
                échappement automatique, aucun HTML interprété. */}
            <p className="prose-body" style={{ marginTop: 'var(--space-2)', whiteSpace: 'pre-wrap' }}>
              {m.body}
            </p>
          </div>
        ))}
      </div>

      <form action={reply} style={{ marginTop: 'var(--space-8)' }}>
        <div className="field">
          <label className="field__label" htmlFor="reply">
            Répondre
          </label>
          <textarea className="field__input" id="reply" name="body" rows={6} required maxLength={4000} />
        </div>
        <button className="btn btn--primary" type="submit" style={{ marginTop: 'var(--space-4)' }}>
          Envoyer
        </button>
      </form>
    </div>
  )
}
