import { withAdmin } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { getEventsVersion } from '@/lib/redis'

export const runtime = 'nodejs'

/**
 * Notifications non lues + version d'événements.
 *
 * Le client interroge cette route toutes les 10 s. La version Redis
 * permet au client de savoir qu'il n'y a RIEN de neuf sans relire
 * la liste : une lecture Redis O(1) plutôt qu'une requête Postgres.
 *
 * DETTE ASSUMÉE : SSE prévu à l'origine (décision D4), remplacé par
 * ce polling sous contrainte de temps. Latence perçue ~10 s au lieu
 * de ~2 s. Documenté dans ARCHITECTURE.md ; l'interface client est
 * conçue pour pouvoir basculer sur SSE sans la modifier.
 */
export async function GET() {
  return withAdmin(async () => {
    const [version, notifications, unreadMessages] = await Promise.all([
      getEventsVersion(),
      prisma.notification.findMany({
        where: { readAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, type: true, title: true, body: true, entityType: true, entityId: true, createdAt: true },
      }),
      prisma.conversation.aggregate({ _sum: { unreadCount: true } }),
    ])

    return Response.json({
      version,
      notifications,
      unreadMessages: unreadMessages._sum.unreadCount ?? 0,
    })
  })
}

export const POST = () => new Response(null, { status: 405, headers: { Allow: 'GET' } })
