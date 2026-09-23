import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { paginationSchema, toSkipTake } from '@/lib/pagination'

export const metadata = { title: 'Messages', robots: { index: false } }

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdminPage()

  const sp = await searchParams
  const pagination = paginationSchema.parse({ page: sp.page, perPage: 20 })

  const [conversations, total] = await prisma.$transaction([
    prisma.conversation.findMany({
      select: {
        id: true,
        subject: true,
        status: true,
        unreadCount: true,
        lastMessageAt: true,
        contact: { select: { name: true, email: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
      ...toSkipTake(pagination),
    }),
    prisma.conversation.count(),
  ])

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">Messages</h1>
      <p className="mono" style={{ marginTop: 'var(--space-2)' }}>
        {total} conversations
      </p>

      <table className="admin-table" style={{ marginTop: 'var(--space-6)' }}>
        <thead>
          <tr>
            <th scope="col">De</th>
            <th scope="col">Sujet</th>
            <th scope="col">Statut</th>
            <th scope="col">Dernier message</th>
          </tr>
        </thead>
        <tbody>
          {conversations.map((c) => (
            <tr key={c.id}>
              <td>
                <Link href={`/admin/messages/${c.id}`}>{c.contact.name}</Link>
                <div className="mono">{c.contact.email}</div>
              </td>
              <td>
                {c.subject}
                {c.unreadCount > 0 && (
                  <span className="badge badge--urgent" style={{ marginLeft: 'var(--space-2)' }}>
                    {c.unreadCount} non lu
                  </span>
                )}
              </td>
              <td>
                <span className={`badge ${c.status === 'OPEN' ? 'badge--urgent' : 'badge--draft'}`}>
                  {c.status === 'OPEN' ? 'Ouverte' : c.status === 'ANSWERED' ? 'Répondue' : 'Close'}
                </span>
              </td>
              <td className="mono mono--data">{c.lastMessageAt.toLocaleString('fr-FR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
