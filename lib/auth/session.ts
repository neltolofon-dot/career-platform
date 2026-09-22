import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { redis, sessionCacheKey, SESSION_CACHE_TTL } from '@/lib/redis'
import type { Role } from '@prisma/client'

/**
 * Le préfixe __Host- est le plus strict des préfixes de cookie :
 * le navigateur REFUSE le cookie s'il n'est pas Secure, s'il a un
 * attribut Domain, ou si Path n'est pas "/". Un sous-domaine compromis
 * ne peut donc pas écraser ce cookie.
 *
 * Il impose Secure, donc impossible en HTTP local : on bascule sur un
 * nom simple en développement.
 */
const IS_PROD = process.env.NODE_ENV === 'production'
export const SESSION_COOKIE = IS_PROD ? '__Host-session' : 'session'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours
const RENEW_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000 // prolonge sous 3 jours restants

export type SessionUser = {
  id: string
  email: string
  name: string
  role: Role
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Crée une session et pose le cookie.
 *
 * Le token brut n'existe QUE dans le cookie du navigateur.
 * La base ne contient que son SHA-256 : un dump de la base ne donne
 * aucune session réutilisable.
 *
 * SHA-256 suffit ici (contrairement aux mots de passe) parce que le token
 * est déjà 32 octets aléatoires : il n'y a rien à deviner par force brute.
 */
export async function createSession(
  userId: string,
  meta: { ipHash?: string; userAgent?: string } = {},
): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipHash: meta.ipHash,
      userAgent: meta.userAgent?.slice(0, 255),
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,   // inaccessible au JavaScript → un XSS ne vole pas la session
    secure: IS_PROD,
    sameSite: 'lax',  // bloque l'envoi du cookie sur les requêtes cross-site (anti-CSRF)
    path: '/',
    expires: expiresAt,
  })
}

/**
 * Lit et valide la session courante. Retourne null si absente, invalide ou expirée.
 * Prolonge la session quand il reste moins de 3 jours (rotation glissante).
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const tokenHash = hashToken(token)

  // Cache Redis — évite un hit Postgres par requête
  const cacheKey = sessionCacheKey(tokenHash)
  const cachedUser = await redis.get<SessionUser>(cacheKey)
  if (cachedUser) return cachedUser

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { id: true, email: true, name: true, role: true } },
    },
  })

  if (!session) return null

  // Session expirée : on nettoie et on refuse
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }

  // Rotation glissante
  const remaining = session.expiresAt.getTime() - Date.now()
  if (remaining < RENEW_THRESHOLD_MS) {
    const newExpiry = new Date(Date.now() + SESSION_TTL_MS)
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: newExpiry },
    })
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'lax',
      path: '/',
      expires: newExpiry,
    })
  }

  const user: SessionUser = session.user
  await redis.set(cacheKey, user, { ex: SESSION_CACHE_TTL })
  return user
}

/** Déconnexion : supprime la session en base, dans le cache et le cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    const tokenHash = hashToken(token)
    await Promise.allSettled([
      prisma.session.deleteMany({ where: { tokenHash } }),
      redis.del(sessionCacheKey(tokenHash)),
    ])
  }

  cookieStore.delete(SESSION_COOKIE)
}

/** Révoque TOUTES les sessions d'un utilisateur (utile après changement de mot de passe). */
export async function revokeAllSessions(userId: string): Promise<void> {
  const sessions = await prisma.session.findMany({
    where: { userId },
    select: { tokenHash: true },
  })
  await prisma.session.deleteMany({ where: { userId } })
  await Promise.allSettled(
    sessions.map((s) => redis.del(sessionCacheKey(s.tokenHash))),
  )
}
