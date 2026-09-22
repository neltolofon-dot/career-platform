# Bloc 1 — Authentification, sessions et RBAC

> **Comment utiliser ce fichier :** dépose-le dans `docs/`, puis donne-le à Claude Code
> avec le prompt en fin de document. Il crée les fichiers, tu lis le code.
>
> **Lis d'abord la section « Le raisonnement ».** C'est ce qu'on te demandera à l'oral,
> pas le code.

---

## Le raisonnement — à comprendre avant de lire une ligne

### Le flux complet, en 6 étapes

```
1. Tu soumets email + mot de passe sur /login
         ↓
2. Rate limit Redis : 10 essais/15min par IP, 5 par compte
   → dépassé ? 429, on s'arrête là, la base n'est même pas interrogée
         ↓
3. Zod valide la forme des données (email valide, mot de passe non vide)
         ↓
4. On cherche l'utilisateur. Argon2id vérifie le mot de passe.
   → si l'email n'existe pas, on vérifie quand même un hash factice
     (sinon le temps de réponse révèle quels emails existent)
         ↓
5. Succès : on génère un token aléatoire de 32 octets.
   → le token BRUT part dans le cookie
   → seul son SHA-256 est stocké en base
         ↓
6. À chaque requête protégée : requireAdmin() lit le cookie, hashe le token,
   cherche la session, vérifie l'expiration, retourne l'utilisateur ou refuse.
```

### Les cinq décisions à défendre

**1. Le token de session n'existe jamais en clair en base.**
On stocke `sha256(token)`. Si quelqu'un dumpe ta base, il obtient des hashs inutilisables :
il ne peut pas les remettre dans un cookie pour se faire passer pour toi. C'est la même
logique que pour un mot de passe, appliquée aux sessions — et presque personne ne le fait.

**2. L'autorisation est au contact de la donnée, pas dans le middleware.**
`requireAdmin()` est appelé dans chaque page `/admin` et chaque route `/api/admin/*`.
Le middleware ne fait que rediriger pour le confort visuel. Raison : le middleware
Next.js a déjà été contourné (CVE-2026-64642, versions 16.0.0 à 16.2.10), et la
recommandation officielle est de déplacer les contrôles dans le data-fetching serveur.
**Une frontière de sécurité ne repose jamais sur une couche que le framework peut
court-circuiter.**

**3. Le rate limiting est à double fenêtre : par IP et par compte.**
Par IP seul ne sert à rien face à un attaquant distribué : il change d'adresse, pas de
cible. Par compte seul permet de balayer des milliers d'emails depuis une IP. Il faut
les deux.

**4. Il n'y a pas de route d'inscription.**
Un seul utilisateur existe, créé par le seed. Pas de `/register`, pas de reset de mot de
passe, pas d'OAuth. **Ce qui n'existe pas ne s'exploite pas.** C'est le principe de
réduction de la surface d'attaque appliqué littéralement.

**5. Le temps de réponse est constant que l'email existe ou non.**
Si on répond instantanément « email inconnu » et lentement « mot de passe faux », un
attaquant énumère tes comptes au chronomètre. On vérifie donc toujours un hash, même
factice.

---

## Fichier 1 — `lib/auth/password.ts`

```ts
import { hash, verify, Algorithm } from '@node-rs/argon2'

/**
 * Paramètres Argon2id recommandés par l'OWASP Password Storage Cheat Sheet :
 * 19 MiB de mémoire, 2 itérations, 1 thread.
 *
 * Pourquoi Argon2id et pas bcrypt : bcrypt est limité en coût mémoire, donc
 * parallélisable sur GPU. Argon2id impose un coût mémoire qui rend l'attaque
 * matérielle massivement plus chère. C'est le standard depuis 2015 (Password
 * Hashing Competition) et la recommandation actuelle de l'OWASP.
 */
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // KiB
  timeCost: 2,
  parallelism: 1,
} as const

/**
 * Hash factice, calculé une fois au chargement du module.
 * Sert à consommer le même temps CPU quand l'email n'existe pas,
 * pour que la réponse ne révèle pas l'existence d'un compte.
 */
let dummyHashCache: string | null = null

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS)
}

export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plain)
  } catch {
    // Hash malformé en base : on refuse, on ne lève pas.
    return false
  }
}

/**
 * À appeler quand l'utilisateur n'existe pas, pour égaliser le temps de réponse.
 * Sans ça, un attaquant distingue « email inconnu » (rapide) de
 * « mot de passe faux » (lent, ~50 ms d'Argon2id) et énumère tes comptes.
 */
export async function consumeTimingBudget(plain: string): Promise<void> {
  if (!dummyHashCache) {
    dummyHashCache = await hashPassword('timing-equalization-placeholder')
  }
  await verifyPassword(dummyHashCache, plain)
}
```

---

## Fichier 2 — `lib/redis.ts`

```ts
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

// ─── 1. RATE LIMITING ────────────────────────────────────────────────────────

/** Par adresse IP : freine un attaquant unique. */
export const loginRateLimitByIp = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '15 m'),
  prefix: 'rl:login:ip',
  analytics: false,
})

/**
 * Par compte : c'est CELUI qui compte.
 * Un attaquant distribué change d'IP mais pas de cible.
 */
export const loginRateLimitByAccount = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'rl:login:acct',
  analytics: false,
})

// ─── 2. CACHE VERSIONNÉ ──────────────────────────────────────────────────────

const CACHE_VERSION_KEY = 'portfolio:version'

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
  const versionedKey = `portfolio:v${version}:${key}`

  const hit = await redis.get<T>(versionedKey)
  if (hit !== null && hit !== undefined) return hit

  const fresh = await producer()
  await redis.set(versionedKey, fresh, { ex: ttlSeconds })
  return fresh
}

// ─── 3. COMPTEUR D'ÉVÉNEMENTS (pour le SSE) ──────────────────────────────────

const EVENTS_KEY = 'events:version'

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
  const ok = await redis.set(`lock:slot:${isoSlot}`, 1, { nx: true, ex: 30 })
  return ok === 'OK'
}

export async function releaseSlotLock(isoSlot: string): Promise<void> {
  await redis.del(`lock:slot:${isoSlot}`)
}

// ─── 5. CACHE DE SESSION ─────────────────────────────────────────────────────

/**
 * Évite un aller-retour Postgres à chaque requête authentifiée.
 * TTL court (60 s) : la source de vérité reste la base, ce qui permet
 * une révocation quasi immédiate. Compromis assumé et documenté.
 */
export const SESSION_CACHE_TTL = 60

export function sessionCacheKey(tokenHash: string): string {
  return `session:${tokenHash}`
}
```

---

## Fichier 3 — `lib/auth/session.ts`

```ts
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
```

---

## Fichier 4 — `lib/auth/guard.ts` ⭐ le cœur du RBAC

```ts
import { redirect } from 'next/navigation'
import { getSession, type SessionUser } from './session'

/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  C'EST ICI QU'EST LA FRONTIÈRE DE SÉCURITÉ.                           │
 * │                                                                       │
 * │  Pas dans middleware.ts. Le middleware Next.js s'exécute avant le     │
 * │  routage et a déjà été contourné : CVE-2026-64642 permettait à une    │
 * │  requête forgée de sauter toute autorisation qui y vivait.            │
 * │                                                                       │
 * │  Ces deux fonctions s'exécutent au contact de la donnée, après le     │
 * │  routage, dans le même processus que la requête Prisma qui suit.      │
 * │  Il n'y a pas de chemin qui atteigne la donnée sans passer par elles. │
 * └───────────────────────────────────────────────────────────────────────┘
 */

/**
 * Pour les SERVER COMPONENTS sous /admin.
 * Redirige vers /login si non authentifié ou non admin.
 *
 * À appeler en PREMIÈRE ligne de chaque page. Pas dans un layout partagé :
 * un layout ne protège pas les pages qu'il n'enveloppe pas, et la protection
 * doit être visible dans le fichier qu'on lit.
 */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await getSession()

  if (!user) redirect('/login')
  if (user.role !== 'ADMIN') redirect('/login')

  return user
}

/**
 * Pour les ROUTE HANDLERS sous /api/admin/*.
 * Lève une erreur typée que le handler transforme en 401 — jamais une
 * redirection : une API répond 401, elle ne renvoie pas une page HTML.
 */
export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'UnauthorizedError'
  }
}

export async function requireAdminApi(): Promise<SessionUser> {
  const user = await getSession()
  if (!user || user.role !== 'ADMIN') throw new UnauthorizedError()
  return user
}

/**
 * Enveloppe standard des route handlers admin.
 * Garantit trois choses sur TOUTES les routes protégées :
 *   - 401 systématique si non autorisé
 *   - aucune fuite de détail d'erreur vers le client
 *   - le détail est journalisé côté serveur avec un identifiant de corrélation
 */
export async function withAdmin<T>(
  handler: (user: SessionUser) => Promise<T>,
): Promise<T | Response> {
  try {
    const user = await requireAdminApi()
    return await handler(user)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ref = crypto.randomUUID()
    console.error(JSON.stringify({ level: 'error', ref, error: String(error) }))

    // Message générique : aucune stack trace, aucun détail Prisma côté client.
    return Response.json({ error: 'Internal error', ref }, { status: 500 })
  }
}
```

---

## Fichier 5 — `lib/prisma.ts`

```ts
import { PrismaClient } from '@prisma/client'

/**
 * Singleton. En développement, le hot reload recrée les modules à chaque
 * sauvegarde : sans ce cache global, on ouvrirait une nouvelle connexion
 * à chaque rechargement jusqu'à épuiser le pool Neon.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

---

## Fichier 6 — `lib/validation/auth.ts`

```ts
import { z } from 'zod'

/**
 * La validation est SERVEUR. Une validation côté client est du confort
 * d'interface, jamais une garantie : le client est sous le contrôle
 * de l'attaquant.
 *
 * Les longueurs maximales ne sont pas cosmétiques : sans elles, un
 * attaquant envoie un mot de passe de 10 Mo et te fait brûler du CPU
 * Argon2id. C'est un déni de service à un euro.
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
})

export type LoginInput = z.infer<typeof loginSchema>
```

---

## Fichier 7 — `lib/request.ts`

```ts
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
```

---

## Fichier 8 — `app/(auth)/login/actions.ts`

```ts
'use server'

import { prisma } from '@/lib/prisma'
import { loginSchema } from '@/lib/validation/auth'
import { verifyPassword, consumeTimingBudget } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { loginRateLimitByIp, loginRateLimitByAccount } from '@/lib/redis'
import { getClientIpHash, getUserAgent } from '@/lib/request'
import { redirect } from 'next/navigation'

export type LoginState = { error?: string }

/**
 * Server Action de connexion.
 *
 * Note CSRF : les Server Actions Next.js vérifient l'en-tête Origin contre
 * l'hôte de la requête. Une soumission depuis un autre domaine est rejetée
 * par le framework avant d'arriver ici. Combiné à SameSite=Lax sur le cookie,
 * ça couvre le CSRF sur ce formulaire.
 */
export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // ── 1. Rate limit par IP — AVANT toute requête base ──────────────────
  const ipHash = await getClientIpHash()
  const ipLimit = await loginRateLimitByIp.limit(ipHash)
  if (!ipLimit.success) {
    return { error: 'Trop de tentatives. Réessayez dans quelques minutes.' }
  }

  // ── 2. Validation Zod ────────────────────────────────────────────────
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    // Message volontairement identique à celui d'un échec d'identifiants :
    // on ne dit pas à l'attaquant quelle partie a échoué.
    return { error: 'Identifiants invalides.' }
  }

  const { email, password } = parsed.data

  // ── 3. Rate limit par compte ─────────────────────────────────────────
  const acctLimit = await loginRateLimitByAccount.limit(email)
  if (!acctLimit.success) {
    return { error: 'Trop de tentatives. Réessayez dans quelques minutes.' }
  }

  // ── 4. Vérification, à temps constant ────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, role: true },
  })

  if (!user) {
    // L'email n'existe pas : on consomme quand même le temps d'un Argon2id.
    // Sans ça, la différence de latence révèle les comptes existants.
    await consumeTimingBudget(password)
    return { error: 'Identifiants invalides.' }
  }

  const valid = await verifyPassword(user.passwordHash, password)
  if (!valid || user.role !== 'ADMIN') {
    return { error: 'Identifiants invalides.' }
  }

  // ── 5. Session ───────────────────────────────────────────────────────
  await createSession(user.id, { ipHash, userAgent: await getUserAgent() })

  redirect('/admin')
}
```

---

## Fichier 9 — `app/(auth)/login/page.tsx`

```tsx
import type { Metadata } from 'next'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = {
  title: 'Connexion',
  robots: { index: false, follow: false }, // hors index des moteurs
}

export default async function LoginPage() {
  // Déjà connecté : on n'affiche pas le formulaire
  const user = await getSession()
  if (user?.role === 'ADMIN') redirect('/admin')

  return (
    <main className="section" data-anchor="3-10">
      <div className="section__meta">
        <span className="mono">Accès</span>
        <span className="mono">Restreint</span>
      </div>

      <div className="section__body" style={{ maxWidth: '26rem' }}>
        <h1 className="display display--section">Connexion</h1>
        <hr className="rule" style={{ margin: 'var(--space-6) 0' }} />
        <LoginForm />
      </div>
    </main>
  )
}
```

---

## Fichier 10 — `app/(auth)/login/LoginForm.tsx`

```tsx
'use client'

// "use client" justifié : useActionState et l'état de soumission
// nécessitent React côté client. Le composant reste minimal —
// toute la logique d'authentification est dans la Server Action.

import { useActionState } from 'react'
import { loginAction, type LoginState } from './actions'

const initialState: LoginState = {}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState)

  return (
    <form action={formAction} noValidate>
      <div className="field" style={{ marginBottom: 'var(--space-6)' }}>
        <label className="field__label" htmlFor="email">
          Adresse e-mail
        </label>
        <input
          className="field__input"
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          aria-invalid={state.error ? 'true' : undefined}
        />
      </div>

      <div className="field" style={{ marginBottom: 'var(--space-8)' }}>
        <label className="field__label" htmlFor="password">
          Mot de passe
        </label>
        <input
          className="field__input"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.error ? 'true' : undefined}
        />
      </div>

      {state.error && (
        <p className="field__error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {state.error}
        </p>
      )}

      <button className="btn btn--primary" type="submit" disabled={pending}>
        {pending ? 'Vérification…' : 'Se connecter'}
      </button>
    </form>
  )
}
```

---

## Fichier 11 — `middleware.ts` (volontairement minuscule)

```ts
import { NextResponse, type NextRequest } from 'next/server'

/**
 * ⚠️ CE FICHIER NE FAIT PAS D'AUTORISATION.
 *
 * Il ne regarde que la PRÉSENCE d'un cookie, jamais sa validité — il ne
 * peut pas : le middleware tourne en Edge runtime, sans accès à Prisma.
 *
 * Son seul rôle est le confort : éviter d'afficher une page admin vide à
 * quelqu'un qui n'est manifestement pas connecté.
 *
 * L'autorisation réelle est dans requireAdminPage() / requireAdminApi(),
 * appelées au contact de la donnée. Voir CVE-2026-64642 : une requête
 * forgée peut sauter ce middleware. Elle ne peut pas sauter un appel de
 * fonction à l'intérieur du composant qui lit la base.
 */

const SESSION_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-session' : 'session'

export function middleware(request: NextRequest) {
  const hasCookie = request.cookies.has(SESSION_COOKIE)

  if (!hasCookie) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

/**
 * IMPORTANT : le matcher ne couvre QUE les pages /admin.
 * Les routes /api/admin/* en sont volontairement exclues — une API doit
 * répondre 401, pas rediriger vers une page HTML. C'est withAdmin() qui
 * s'en charge.
 */
export const config = {
  matcher: ['/admin/:path*'],
}
```

---

## Fichier 12 — `next.config.ts` (en-têtes HTTP)

```ts
import type { NextConfig } from 'next'

/**
 * Content-Security-Policy.
 *
 * ⚠️ 'unsafe-inline' sur script-src est un COMPROMIS TEMPORAIRE : Next.js
 * injecte des scripts inline pour l'hydratation. La solution propre est un
 * nonce par requête généré dans le middleware. À resserrer à H20 — noté
 * dans SECURITY.md comme dette assumée, pas comme oubli.
 *
 * Tout le reste est déjà strict :
 *   - object-src 'none'     → pas de Flash/plugins, vecteur XSS historique
 *   - frame-ancestors 'none'→ anti-clickjacking (remplace X-Frame-Options)
 *   - base-uri 'self'       → empêche de détourner les URLs relatives
 *   - form-action 'self'    → un formulaire injecté ne peut pas exfiltrer ailleurs
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const nextConfig: NextConfig = {
  poweredByHeader: false, // retire X-Powered-By: Next.js → moins d'info à l'attaquant
  reactStrictMode: true,

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          // Empêche le navigateur de "deviner" un type MIME :
          // un .txt contenant du JS ne sera pas exécuté.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Frame-Options', value: 'DENY' }, // repli pour vieux navigateurs
        ],
      },
    ]
  },
}

export default nextConfig
```

---

## Fichier 13 — `app/admin/page.tsx` (squelette de démonstration)

```tsx
import { requireAdminPage } from '@/lib/auth/guard'
import { logoutAction } from './actions'

export const metadata = { robots: { index: false, follow: false } }

export default async function AdminOverviewPage() {
  // ← PREMIÈRE LIGNE. Toujours. Dans chaque page admin.
  const user = await requireAdminPage()

  return (
    <main className="section admin" data-anchor="1-12">
      <div className="section__meta">
        <span className="mono">Admin</span>
        <span className="mono">Overview</span>
      </div>

      <div className="section__body">
        <h1 className="display display--section">Tableau de bord</h1>
        <p className="mono mono--data" style={{ marginTop: 'var(--space-4)' }}>
          {user.email} · {user.role}
        </p>

        <form action={logoutAction} style={{ marginTop: 'var(--space-8)' }}>
          <button className="btn" type="submit">Se déconnecter</button>
        </form>
      </div>
    </main>
  )
}
```

## Fichier 14 — `app/admin/actions.ts`

```ts
'use server'

import { destroySession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export async function logoutAction() {
  await destroySession()
  redirect('/login')
}
```

---

## Fichier 15 — `app/api/admin/ping/route.ts` (route de test du 401)

```ts
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
```

---

## Tests à passer — ils iront dans `SECURITY.md`

```bash
# 1. API admin sans cookie → 401 (et PAS une redirection 3xx)
curl -i https://career-platform-pied.vercel.app/api/admin/ping

# 2. Page admin sans cookie → 307/302 vers /login
curl -i https://career-platform-pied.vercel.app/admin

# 3. Méthode non autorisée → 405
curl -i -X POST https://career-platform-pied.vercel.app/api/admin/ping

# 4. Brute force → PAS un test curl. loginAction est une Server Action :
#    Next.js encapsule toujours sa réponse dans un payload RSC en 200, succès
#    ou échec confondus. Un curl -w "%{http_code}" ne peut donc PAS observer
#    le blocage — ce n'est pas un défaut d'implémentation, c'est le
#    comportement du framework. Voir scripts/test-ratelimit.mjs : un test
#    Playwright scripté qui lit le message affiché à l'écran (6 tentatives,
#    blocage attendu à la 6e). Lancer : npm run test:ratelimit

# 5. En-têtes de sécurité présents
curl -sI https://career-platform-pied.vercel.app/ | grep -iE \
  "content-security|x-content-type|referrer|permissions|strict-transport"

# 6. Cookie correctement configuré (après connexion réelle dans le navigateur)
#    DevTools > Application > Cookies : HttpOnly ✓ Secure ✓ SameSite=Lax ✓
```

---

## Prompt pour Claude Code

```
Lis CLAUDE.md, puis docs/07-AUTH-CODE.md en entier.

Crée les 15 fichiers exactement comme spécifiés, aux chemins indiqués,
en conservant TOUS les commentaires — ils sont la documentation de mes
décisions et me serviront à l'oral.

Ensuite :
1. npx tsc --noEmit  → aucune erreur
2. npm run build     → doit passer
3. npm run dev, et teste en local :
   - curl -i http://localhost:3000/api/admin/ping     → 401
   - curl -i http://localhost:3000/admin              → redirection /login
   - curl -i -X POST http://localhost:3000/api/admin/ping → 405
4. Connecte-toi réellement avec ADMIN_EMAIL / ADMIN_PASSWORD de .env
   et confirme que /admin s'affiche.
5. Déclenche le rate limit avec 12 tentatives erronées et confirme
   que le message de blocage apparaît.
6. Déploie et rejoue les 6 tests de la section "Tests à passer" contre
   l'URL de production. Donne-moi la sortie brute de chacun.
7. Ajoute ces tests et leurs résultats dans SECURITY.md, section
   "Vérifications d'authentification et de contrôle d'accès".

Si un test échoue, ARRÊTE-TOI et dis-le-moi — ne contourne pas.

Commit : "feat: authentification Argon2id, sessions opaques et RBAC"
```

---

## Tes trois questions de contrôle

Réponds-moi **sans relire le code**. Si tu sèches sur une, on la reprend avant d'avancer —
c'est exactement ce que le jury va te demander.

**Q1.** Quelqu'un vole une copie complète de ta base de données. Peut-il se connecter à
ton `/admin` avec ce qu'il y trouve ? Pourquoi ?

**Q2.** Pourquoi le contrôle d'autorisation n'est-il pas dans `middleware.ts`, alors que
c'est ce que font la plupart des tutoriels Next.js ?

**Q3.** Pourquoi le code vérifie-t-il un hash de mot de passe même quand l'email n'existe
pas en base ? Qu'est-ce que ça empêche concrètement ?
