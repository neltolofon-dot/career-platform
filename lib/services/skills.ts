import { prisma } from '@/lib/prisma'
import { cached } from '@/lib/redis'
import { skillCreateSchema, skillUpdateSchema } from '@/lib/validation/skill'
import { paginate, toSkipTake, type Pagination } from '@/lib/pagination'
import {
  ValidationError,
  ConflictError,
  NotFoundError,
  parseOrThrow,
  afterContentWrite,
  translatePrismaError,
} from '@/lib/services/_shared'

/**
 * Patron de lib/services/projects.ts, répliqué. Différence : pas de champ
 * `status` sur Skill (le modèle n'a pas de notion de brouillon), et le tri
 * public suit category puis order plutôt qu'une date.
 */
export { ValidationError, ConflictError, NotFoundError }

// ─── LECTURES ────────────────────────────────────────────────────────────────

/** Liste admin : paginée, triée par catégorie puis ordre. */
export async function listSkillsForAdmin(pagination: Pagination) {
  const [items, total] = await prisma.$transaction([
    prisma.skill.findMany({
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
      ...toSkipTake(pagination),
    }),
    prisma.skill.count(),
  ])

  return paginate(items, total, pagination)
}

/** Liste publique : toutes les compétences (pas de statut), mise en cache. */
export async function listPublishedSkills() {
  return cached('skills:published', 300, async () =>
    prisma.skill.findMany({
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    }),
  )
}

export async function getSkillForAdmin(id: string) {
  const skill = await prisma.skill.findUnique({ where: { id } })
  if (!skill) throw new NotFoundError()
  return skill
}

// ─── ÉCRITURES ───────────────────────────────────────────────────────────────

const CONFLICT_MESSAGE = 'Cette compétence existe déjà dans cette catégorie.'

export async function createSkill(raw: unknown) {
  const data = parseOrThrow(skillCreateSchema, raw)

  try {
    const skill = await prisma.skill.create({ data })
    await afterWrite(skill.id)
    return skill
  } catch (error) {
    throw translatePrismaError(error, CONFLICT_MESSAGE)
  }
}

export async function updateSkill(id: string, raw: unknown) {
  const data = parseOrThrow(skillUpdateSchema, raw)

  try {
    const skill = await prisma.skill.update({ where: { id }, data })
    await afterWrite(skill.id)
    return skill
  } catch (error) {
    throw translatePrismaError(error, CONFLICT_MESSAGE)
  }
}

export async function deleteSkill(id: string) {
  try {
    await prisma.skill.delete({ where: { id } })
    await afterWrite(id, { removed: true })
  } catch (error) {
    throw translatePrismaError(error, CONFLICT_MESSAGE)
  }
}

// ─── EFFETS DE BORD ──────────────────────────────────────────────────────────

async function afterWrite(skillId: string, opts: { removed?: boolean } = {}) {
  await afterContentWrite('SKILL', skillId, opts.removed ?? false)
}
