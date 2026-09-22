import { hash, verify } from '@node-rs/argon2'

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
  // 2 = Algorithm.Argon2id. Valeur littérale et non l'enum importé : `Algorithm`
  // de @node-rs/argon2 est un `const enum` ambiant (objet runtime vide, {}),
  // que `isolatedModules` (imposé par Next.js/SWC) refuse d'inliner — chaque
  // fichier est compilé isolément, sans connaître les membres de l'enum.
  // 2 est exactement la valeur que le compilateur aurait produite lui-même.
  algorithm: 2,
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
