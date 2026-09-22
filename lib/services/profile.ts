import { prisma } from '@/lib/prisma'
import { cached } from '@/lib/redis'
import { profileUpdateSchema } from '@/lib/validation/profile'
import {
  ValidationError,
  ConflictError,
  NotFoundError,
  parseOrThrow,
  afterContentWrite,
  translatePrismaError,
} from '@/lib/services/_shared'

/**
 * Profile est un SINGLETON : id figé à "profile" (créé par le seed).
 * Pas de pagination, pas de liste, pas de création, pas de suppression —
 * seulement lecture et mise à jour. C'est la différence structurelle avec
 * le patron projects/experiences/skills/articles, qui sont des collections.
 */
export { ValidationError, ConflictError, NotFoundError }

const PROFILE_ID = 'profile'

export async function getProfileForAdmin() {
  const profile = await prisma.profile.findUnique({ where: { id: PROFILE_ID } })
  if (!profile) throw new NotFoundError()
  return profile
}

/** Lecture publique : la ligne unique, mise en cache — c'est elle qui alimente les métadonnées vivantes de l'ouverture. */
export async function getPublishedProfile() {
  return cached('profile:published', 300, async () =>
    prisma.profile.findUnique({ where: { id: PROFILE_ID } }),
  )
}

export async function updateProfile(raw: unknown) {
  const data = parseOrThrow(profileUpdateSchema, raw)

  try {
    const profile = await prisma.profile.update({
      where: { id: PROFILE_ID },
      data,
    })

    await afterContentWrite('PROFILE', PROFILE_ID)
    return profile
  } catch (error) {
    throw translatePrismaError(error)
  }
}
