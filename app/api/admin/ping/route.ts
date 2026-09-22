import { withAdmin } from '@/lib/auth/guard'

// Prisma et Argon2id nécessitent le runtime Node, pas Edge.
export const runtime = 'nodejs'

/**
 * Route de démonstration du RBAC. Sert aux tests de SECURITY.md :
 * sans cookie valide elle répond 401, jamais une redirection.
 */
export async function GET() {
  return withAdmin(async (user) => {
    return Response.json({ ok: true, user: user.email })
  })
}

// Toute autre méthode → 405 explicite plutôt que le comportement par défaut.
export async function POST() {
  return new Response(null, { status: 405, headers: { Allow: 'GET' } })
}
