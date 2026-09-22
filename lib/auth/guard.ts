import { redirect } from 'next/navigation'
import { getSession, type SessionUser } from './session'

/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  C'EST ICI QU'EST LA FRONTIÈRE DE SÉCURITÉ.                           │
 * │                                                                       │
 * │  Pas dans middleware.ts. Le middleware Next.js s'exécute avant le     │
 * │  routage et a déjà été contourné : CVE-2026-64642 permettait à une    │
 * │  requête forgée de sauter toute autorisation qui y vivait.            │
 * │                                                                       │
 * │  Ces deux fonctions s'exécutent au contact de la donnée, après le     │
 * │  routage, dans le même processus que la requête Prisma qui suit.      │
 * │  Il n'y a pas de chemin qui atteigne la donnée sans passer par elles. │
 * └───────────────────────────────────────────────────────────────────────┘
 */

/**
 * Pour les SERVER COMPONENTS sous /admin.
 * Redirige vers /login si non authentifié ou non admin.
 *
 * À appeler en PREMIÈRE ligne de chaque page. Pas dans un layout partagé :
 * un layout ne protège pas les pages qu'il n'enveloppe pas, et la protection
 * doit être visible dans le fichier qu'on lit.
 */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await getSession()

  if (!user) redirect('/login')
  if (user.role !== 'ADMIN') redirect('/login')

  return user
}

/**
 * Pour les ROUTE HANDLERS sous /api/admin/*.
 * Lève une erreur typée que le handler transforme en 401 — jamais une
 * redirection : une API répond 401, elle ne renvoie pas une page HTML.
 */
export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'UnauthorizedError'
  }
}

export async function requireAdminApi(): Promise<SessionUser> {
  const user = await getSession()
  if (!user || user.role !== 'ADMIN') throw new UnauthorizedError()
  return user
}

/**
 * Enveloppe standard des route handlers admin.
 * Garantit trois choses sur TOUTES les routes protégées :
 *   - 401 systématique si non autorisé
 *   - aucune fuite de détail d'erreur vers le client
 *   - le détail est journalisé côté serveur avec un identifiant de corrélation
 */
export async function withAdmin<T>(
  handler: (user: SessionUser) => Promise<T>,
): Promise<T | Response> {
  try {
    const user = await requireAdminApi()
    return await handler(user)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ref = crypto.randomUUID()
    console.error(JSON.stringify({ level: 'error', ref, error: String(error) }))

    // Message générique : aucune stack trace, aucun détail Prisma côté client.
    return Response.json({ error: 'Internal error', ref }, { status: 500 })
  }
}
