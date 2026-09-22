import { Prisma, type ContentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { cached } from '@/lib/redis'
import {
  experienceCreateSchema,
  experienceUpdateSchema,
} from '@/lib/validation/experience'
import {
  paginate,
  toSkipTake,
  type Pagination,
  type Paginated,
} from '@/lib/pagination'
import {
  ValidationError,
  ConflictError,
  NotFoundError,
  parseOrThrow,
  afterContentWrite,
  translatePrismaError,
} from '@/lib/services/_shared'

/**
 * Patron de lib/services/projects.ts, répliqué (docs/08-CMS-CODE.md § intro).
 * Différence principale : pas de slug, pas de cache par clé individuelle —
 * une expérience n'a pas de page dédiée, seulement la chronologie publique.
 */
export { ValidationError, ConflictError, NotFoundError }

const LIST_SELECT = {
  id: true,
  org: true,
  role: true,
  location: true,
  startDate: true,
  endDate: true,
  current: true,
  status: true,
  order: true,
  updatedAt: true,
} satisfies Prisma.ExperienceSelect

// ─── LECTURES ────────────────────────────────────────────────────────────────

/** Liste admin : tous statuts confondus, paginée, triée par date de début décroissante. */
export async function listExperiencesForAdmin(
  pagination: Pagination,
  filters: { status?: ContentStatus } = {},
): Promise<Paginated<Prisma.ExperienceGetPayload<{ select: typeof LIST_SELECT }>>> {
  const where: Prisma.ExperienceWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.experience.findMany({
      where,
      select: LIST_SELECT,
      orderBy: [{ startDate: 'desc' }],
      ...toSkipTake(pagination),
    }),
    prisma.experience.count({ where }),
  ])

  return paginate(items, total, pagination)
}

/** Liste publique : uniquement PUBLISHED, mise en cache. Couverte par @@index([status, startDate]). */
export async function listPublishedExperiences() {
  return cached('experiences:published', 300, async () =>
    prisma.experience.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ startDate: 'desc' }],
    }),
  )
}

export async function getExperienceForAdmin(id: string) {
  const experience = await prisma.experience.findUnique({ where: { id } })
  if (!experience) throw new NotFoundError()
  return experience
}

// ─── ÉCRITURES ───────────────────────────────────────────────────────────────

export async function createExperience(raw: unknown) {
  const data = parseOrThrow(experienceCreateSchema, raw)

  try {
    const experience = await prisma.experience.create({ data })
    await afterWrite(experience.id)
    return experience
  } catch (error) {
    throw translatePrismaError(error)
  }
}

export async function updateExperience(id: string, raw: unknown) {
  const data = parseOrThrow(experienceUpdateSchema, raw)

  try {
    const experience = await prisma.experience.update({ where: { id }, data })
    await afterWrite(experience.id)
    return experience
  } catch (error) {
    throw translatePrismaError(error)
  }
}

export async function deleteExperience(id: string) {
  try {
    await prisma.experience.delete({ where: { id } })
    await afterWrite(id, { removed: true })
  } catch (error) {
    throw translatePrismaError(error)
  }
}

// ─── EFFETS DE BORD ──────────────────────────────────────────────────────────

async function afterWrite(experienceId: string, opts: { removed?: boolean } = {}) {
  await afterContentWrite('EXPERIENCE', experienceId, opts.removed ?? false)
}
