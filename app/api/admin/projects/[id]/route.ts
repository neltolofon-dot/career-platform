import { withAdmin } from '@/lib/auth/guard'
import {
  getProjectForAdmin,
  updateProject,
  deleteProject,
  ValidationError,
  ConflictError,
  NotFoundError,
} from '@/lib/services/projects'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 256 * 1024

// Next.js 15+ : params est une Promise.
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Ctx) {
  return withAdmin(async () => {
    const { id } = await params
    try {
      return Response.json(await getProjectForAdmin(id))
    } catch (error) {
      if (error instanceof NotFoundError) {
        return Response.json({ error: 'Introuvable' }, { status: 404 })
      }
      throw error
    }
  })
}

export async function PATCH(request: Request, { params }: Ctx) {
  return withAdmin(async () => {
    const { id } = await params

    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
      return Response.json({ error: 'Payload trop volumineux' }, { status: 413 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'JSON invalide' }, { status: 400 })
    }

    try {
      return Response.json(await updateProject(id, body))
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

export async function DELETE(_request: Request, { params }: Ctx) {
  return withAdmin(async () => {
    const { id } = await params
    try {
      await deleteProject(id)
      return new Response(null, { status: 204 })
    } catch (error) {
      if (error instanceof NotFoundError) {
        return Response.json({ error: 'Introuvable' }, { status: 404 })
      }
      throw error
    }
  })
}

const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: 'GET, PATCH, DELETE' } })

export const POST = methodNotAllowed
export const PUT = methodNotAllowed
