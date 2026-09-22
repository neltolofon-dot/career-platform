import { withAdmin } from '@/lib/auth/guard'
import { paginationSchema } from '@/lib/pagination'
import {
  listArticlesForAdmin,
  createArticle,
  ValidationError,
  ConflictError,
} from '@/lib/services/articles'

export const runtime = 'nodejs'

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

    const result = await listArticlesForAdmin(parsed.data, { status: status as never })
    return Response.json(result)
  })
}

export async function POST(request: Request) {
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
      const article = await createArticle(body)
      return Response.json(article, { status: 201 })
    } catch (error) {
      if (error instanceof ValidationError) {
        return Response.json({ error: 'Validation', fields: error.fields }, { status: 422 })
      }
      if (error instanceof ConflictError) {
        return Response.json({ error: error.message }, { status: 409 })
      }
      throw error
    }
  })
}

const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: 'GET, POST' } })

export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
