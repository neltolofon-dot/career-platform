import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

/**
 * Client REST Upstash.
 *
 * Pourquoi REST et pas le protocole Redis : les fonctions serverless Vercel ne
 * maintiennent aucune connexion TCP entre deux invocations. Un pool de connexions
 * Redis classique n'a pas de sens ici — chaque appel repartirait de zéro.
 * C'est aussi la raison pour laquelle le temps réel passe par SSE et non WebSocket.
 */
export const redis = Redis.fromEnv()

/**
 * Isolation par environnement : une seule base Upstash sert le dev, les
 * preview et la production. Sans préfixe, un test local consomme le quota
 * de rate limit de production et invalide le cache des visiteurs réels.
 */
const ENV = process.env.VERCEL_ENV ?? 'dev' // 'production' | 'preview' | 'dev'

// ─── 1. RATE LIMITING ────────────────────────────────────────────────────────

/** Par adresse IP : freine un attaquant unique. */
export const loginRateLimitByIp = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '15 m'),
  prefix: `rl:${ENV}:login:ip`,
  analytics: false,
})

/**
 * Par compte : c'est CELUI qui compte.
 * Un attaquant distribué change d'IP mais pas de cible.
 */
export const loginRateLimitByAccount = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: `rl:${ENV}:login:acct`,
  analytics: false,
})

// ─── 2. CACHE VERSIONNÉ ──────────────────────────────────────────────────────

const CACHE_VERSION_KEY = `${ENV}:portfolio:version`

/**
 * Invalidation par version plutôt que par suppression de clés.
 *
 * Toutes les clés de cache embarquent un numéro de version :
 *   portfolio:v7:projects, portfolio:v7:articles, …
 *
 * Une écriture admin incrémente la version → toutes les anciennes clés
 * deviennent inatteignables d'un coup. Pas de SCAN, pas de DEL en masse,
 * et surtout aucun risque d'oublier une clé quand on ajoute une page.
 * Les clés orphelines expirent seules par TTL.
 */
export async function getCacheVersion(): Promise<number> {
  const v = await redis.get<number>(CACHE_VERSION_KEY)
  return v ?? 1
}

export async function bumpCacheVersion(): Promise<void> {
  await redis.incr(CACHE_VERSION_KEY)
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  producer: () => Promise<T>,
): Promise<T> {
  const version = await getCacheVersion()
  const versionedKey = `${ENV}:portfolio:v${version}:${key}`

  const hit = await redis.get<T>(versionedKey)
  if (hit !== null && hit !== undefined) return hit

  const fresh = await producer()
  await redis.set(versionedKey, fresh, { ex: ttlSeconds })
  return fresh
}

// ─── 3. COMPTEUR D'ÉVÉNEMENTS (pour le SSE) ──────────────────────────────────

const EVENTS_KEY = `${ENV}:events:version`

/** Appelé à chaque écriture notifiable : nouveau message, lead, réservation. */
export async function bumpEvents(): Promise<void> {
  await redis.incr(EVENTS_KEY)
}

export async function getEventsVersion(): Promise<number> {
  return (await redis.get<number>(EVENTS_KEY)) ?? 0
}

// ─── 4. VERROU DE CRÉNEAU (anti double-réservation) ──────────────────────────

/**
 * Verrou best-effort. Ce n'est PAS la garantie de correction —
 * celle-ci est l'index unique partiel en base. Le verrou évite simplement
 * d'atteindre Postgres dans le cas courant.
 */
export async function acquireSlotLock(isoSlot: string): Promise<boolean> {
  const ok = await redis.set(`${ENV}:lock:slot:${isoSlot}`, 1, { nx: true, ex: 30 })
  return ok === 'OK'
}

export async function releaseSlotLock(isoSlot: string): Promise<void> {
  await redis.del(`${ENV}:lock:slot:${isoSlot}`)
}

// ─── 5. CACHE DE SESSION ─────────────────────────────────────────────────────

/**
 * Évite un aller-retour Postgres à chaque requête authentifiée.
 * TTL court (60 s) : la source de vérité reste la base, ce qui permet
 * une révocation quasi immédiate. Compromis assumé et documenté.
 */
export const SESSION_CACHE_TTL = 60

export function sessionCacheKey(tokenHash: string): string {
  return `${ENV}:session:${tokenHash}`
}
