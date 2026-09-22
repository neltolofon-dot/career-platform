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
