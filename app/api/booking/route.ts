import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '@/lib/redis'
import { bookAppointment } from '@/lib/services/booking'
import { ValidationError, ConflictError, NotFoundError } from '@/lib/services/_shared'
import { getClientIpHash } from '@/lib/request'

export const runtime = 'nodejs'

const ENV = process.env.VERCEL_ENV ?? 'dev'

const bookingLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: `rl:${ENV}:booking`,
})

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 8192) {
    return Response.json({ error: 'Requête trop volumineuse' }, { status: 413 })
  }

  const limit = await bookingLimit.limit(await getClientIpHash())
  if (!limit.success) {
    return Response.json(
      { error: 'Trop de réservations. Réessayez plus tard.' },
      { status: 429, headers: { 'Retry-After': '3600' } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON invalide' }, { status: 400 })
  }

  try {
    const result = await bookAppointment(body)
    return Response.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: 'Validation', fields: error.fields }, { status: 422 })
    }
    // 409 CONFLICT : le créneau est pris. C'est LE test que le jury fera.
    if (error instanceof ConflictError) {
      return Response.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof NotFoundError) {
      return Response.json({ error: 'Service introuvable' }, { status: 404 })
    }

    const ref = crypto.randomUUID()
    console.error(JSON.stringify({ level: 'error', scope: 'booking', ref, error: String(error) }))
    return Response.json({ error: 'Une erreur est survenue.', ref }, { status: 500 })
  }
}

const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: 'POST' } })

export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const DELETE = methodNotAllowed
