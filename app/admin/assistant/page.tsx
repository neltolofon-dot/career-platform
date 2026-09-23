import { requireAdminPage } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { countChunks, lastIndexedAt } from '@/lib/rag/index'
import { reindexAction } from './actions'

export const metadata = { title: 'AI Assistant', robots: { index: false } }

export default async function AssistantPage() {
  await requireAdminPage()

  const [chunks, lastIndexed, recent] = await Promise.all([
    countChunks(),
    lastIndexedAt(),
    prisma.chatMessage.findMany({
      where: { role: 'USER' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { content: true, createdAt: true },
    }),
  ])

  const refusedCount = await prisma.chatMessage.count({ where: { refused: true } })

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">Assistant IA</h1>

      <dl style={{ display: 'flex', gap: 'var(--space-12)', marginTop: 'var(--space-6)' }}>
        <div>
          <dt className="mono">Chunks indexés</dt>
          <dd className="mono mono--data" style={{ fontSize: 'var(--text-xl)', margin: 0 }}>
            {chunks}
          </dd>
        </div>
        <div>
          <dt className="mono">Dernière indexation</dt>
          <dd className="mono mono--data" style={{ margin: 0 }}>
            {lastIndexed ? lastIndexed.toLocaleString('fr-FR') : 'jamais'}
          </dd>
        </div>
        <div>
          <dt className="mono">Refus émis</dt>
          <dd className="mono mono--data" style={{ fontSize: 'var(--text-xl)', margin: 0 }}>
            {refusedCount}
          </dd>
        </div>
      </dl>

      <form action={reindexAction} style={{ marginTop: 'var(--space-8)' }}>
        <button className="btn btn--primary" type="submit">
          Réindexer la base de connaissances
        </button>
      </form>

      <h2 style={{ marginTop: 'var(--space-12)', fontSize: 'var(--text-xl)' }}>
        Questions récentes
      </h2>
      <table className="admin-table" style={{ marginTop: 'var(--space-4)' }}>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Question</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((m, i) => (
            <tr key={i}>
              <td className="mono mono--data">{m.createdAt.toLocaleString('fr-FR')}</td>
              <td>{m.content}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
