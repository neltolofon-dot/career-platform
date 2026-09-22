import { withAdmin } from '@/lib/auth/guard'
import {
  getProfileForAdmin,
  updateProfile,
  ValidationError,
  ConflictError,
  NotFoundError,
} from '@/lib/services/profile'

export const runtime = 'nodejs'

/** Limite de taille du corps : 256 Ko. Au-delà, on refuse sans lire. */
const MAX_BODY_BYTES = 256 * 1024

/**
 * Pas de route /api/admin/profile/[id] : Profile est un singleton, il n'y a
 * qu'une seule ressource, jamais identifiée par un id variable. GET et PATCH
 * suffisent — pas de POST (rien à créer), pas de DELETE (rien à supprimer).
 */
export async function GET() {
  return withAdmin(async () => {
    try {
      return Response.json(await getProfileForAdmin())
    } catch (error) {
      if (error instanceof NotFoundError) {
        return Response.json({ error: 'Introuvable' }, { status: 404 })
      }
      throw error
    }
  })
}

export async function PATCH(request: Request) {
  return withAdmin(async () => {
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
      return Response.json(await updateProfile(body))
    } catch (error) {
      if (error instanceof ValidationError) {
        return Response.json({ error: 'Validation', fields: error.fields }, { status: 422 })
      }
      if (error instanceof ConflictError) {
        return Response.json({ error: error.message }, { status: 409 })
      }
      if (error instanceof NotFoundError) {
        return Response.json({ error: 'Introuvable' }, { status: 404 })
      }
      throw error
    }
  })
}

const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: 'GET, PATCH' } })

export const POST = methodNotAllowed
export const PUT = methodNotAllowed
export const DELETE = methodNotAllowed
