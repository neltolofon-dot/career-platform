import { createHash } from 'node:crypto'
import { headers } from 'next/headers'

/**
 * Hash d'IP pour le rate limiting et les logs.
 *
 * On ne stocke JAMAIS d'IP en clair : c'est une donnée personnelle au sens
 * du RGPD, et on n'en a pas besoin. Le sel tournant quotidien empêche en
 * plus tout recoupement d'un jour sur l'autre.
 */
export async function getClientIpHash(): Promise<string> {
  const h = await headers()
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'

  const day = new Date().toISOString().slice(0, 10)
  const salt = process.env.SESSION_SECRET ?? 'fallback'

  return createHash('sha256').update(`${ip}|${day}|${salt}`).digest('hex').slice(0, 32)
}

export async function getUserAgent(): Promise<string | undefined> {
  const h = await headers()
  return h.get('user-agent') ?? undefined
}
