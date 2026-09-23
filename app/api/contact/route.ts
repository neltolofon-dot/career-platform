import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '@/lib/redis'
import { submitContact } from '@/lib/services/contact'
import { ValidationError } from '@/lib/services/_shared'
import { getClientIpHash } from '@/lib/request'

export const runtime = 'nodejs'

const ENV = process.env.VERCEL_ENV ?? 'dev'
const MAX_BODY = 16 * 1024

/**
 * Contrairement au login (Server Action, toujours 200 par protocole RSC),
 * cette route renvoie de VRAIS 429 observables au curl. C'est ici qu'un
 * auditeur peut constater le rate limiting sans outil particulier.
 */
const contactLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: `rl:${ENV}:contact`,
})

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) {
    return Response.json({ error: 'Requête trop volumineuse' }, { status: 413 })
  }

  const ipHash = await getClientIpHash()
  const limit = await contactLimit.limit(ipHash)

  if (!limit.success) {
    return Response.json(
      { error: 'Trop de messages envoyés. Réessayez plus tard.' },
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
    await submitContact(body)
    return Response.json({ ok: true }, { status: 201 })
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: 'Validation', fields: error.fields }, { status: 422 })
    }
    const ref = crypto.randomUUID()
    console.error(JSON.stringify({ level: 'error', scope: 'contact', ref, error: String(error) }))
    return Response.json({ error: 'Une erreur est survenue.', ref }, { status: 500 })
  }
}

const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: 'POST' } })

export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const DELETE = methodNotAllowed
