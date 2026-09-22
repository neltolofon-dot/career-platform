import { withAdmin } from '@/lib/auth/guard'
import { paginationSchema } from '@/lib/pagination'
import {
  listProjectsForAdmin,
  createProject,
  ValidationError,
  ConflictError,
} from '@/lib/services/projects'

// Prisma nécessite le runtime Node, pas Edge.
export const runtime = 'nodejs'

/** Limite de taille du corps : 256 Ko. Au-delà, on refuse sans lire. */
const MAX_BODY_BYTES = 256 * 1024

export async function GET(request: Request) {
  return withAdmin(async () => {
    const url = new URL(request.url)

    const parsed = paginationSchema.safeParse({
      page: url.searchParams.get('page') ?? undefined,
      perPage: url.searchParams.get('perPage') ?? undefined,
    })

    if (!parsed.success) {
      return Response.json({ error: 'Paramètres de pagination invalides' }, { status: 400 })
    }

    const status = url.searchParams.get('status') ?? undefined
    const q = url.searchParams.get('q')?.slice(0, 100) ?? undefined

    const result = await listProjectsForAdmin(parsed.data, {
      status: status as never,
      q,
    })

    return Response.json(result)
  })
}

export async function POST(request: Request) {
  return withAdmin(async () => {
    // Contrôle de taille AVANT de lire le corps
    const length = Number(request.headers.get('content-length') ?? 0)
    if (length > MAX_BODY_BYTES) {
      return Response.json({ error: 'Payload trop volumineux' }, { status: 413 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'JSON invalide' }, { status: 400 })
    }

    try {
      const project = await createProject(body)
      return Response.json(project, { status: 201 })
    } catch (error) {
      if (error instanceof ValidationError) {
        return Response.json({ error: 'Validation', fields: error.fields }, { status: 422 })
      }
      if (error instanceof ConflictError) {
        return Response.json({ error: error.message }, { status: 409 })
      }
      throw error // withAdmin journalise et renvoie un 500 générique
    }
  })
}

/**
 * Méthodes non autorisées → 405 explicite avec l'en-tête Allow,
 * plutôt que le comportement par défaut du framework.
 * Exigé par le sujet : « méthodes HTTP explicitement autorisées ».
 */
const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: 'GET, POST' } })

export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
