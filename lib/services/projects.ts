import { Prisma, type ContentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { cached } from '@/lib/redis'
import {
  projectCreateSchema,
  projectUpdateSchema,
} from '@/lib/validation/project'
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
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  COUCHE SERVICE — la logique métier vit ICI, une seule fois.         │
 * │                                                                      │
 * │  Les Server Actions (formulaires admin) et les route handlers        │
 * │  (/api/admin/projects) appellent ces fonctions. Ce sont deux         │
 * │  TRANSPORTS, ils ne contiennent aucune règle.                        │
 * │                                                                      │
 * │  Conséquence : mon API et mon admin ne peuvent pas diverger.         │
 * └──────────────────────────────────────────────────────────────────────┘
 */

// Erreurs métier et helpers partagés (validation, effets de bord, erreurs
// Prisma) : voir lib/services/_shared.ts, ré-exportés pour que les
// transports existants (app/api/admin/projects/*, app/admin/projects/actions.ts)
// continuent d'importer ValidationError/ConflictError/NotFoundError depuis ce fichier.
export { ValidationError, ConflictError, NotFoundError }

// ─── SÉLECTIONS ──────────────────────────────────────────────────────────────

/**
 * Sélection explicite plutôt que le modèle entier.
 * Deux raisons : on ne transfère que ce qu'on affiche (performance), et on
 * ne peut pas exposer par accident un champ ajouté plus tard au schéma.
 */
const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  domain: true,
  role: true,
  year: true,
  stack: true,
  status: true,
  featured: true,
  order: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect

const PUBLIC_SELECT = {
  ...LIST_SELECT,
  summary: true,
  links: true,
  cover: { select: { url: true, alt: true, width: true, height: true, blurDataUrl: true } },
} satisfies Prisma.ProjectSelect

// ─── LECTURES ────────────────────────────────────────────────────────────────

/** Liste admin : tous statuts confondus, paginée. */
export async function listProjectsForAdmin(
  pagination: Pagination,
  filters: { status?: ContentStatus; q?: string } = {},
): Promise<Paginated<Prisma.ProjectGetPayload<{ select: typeof LIST_SELECT }>>> {
  const where: Prisma.ProjectWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? {
          OR: [
            { title: { contains: filters.q, mode: 'insensitive' } },
            { domain: { contains: filters.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  // Transaction : le count et la page proviennent du même instantané.
  // Sans ça, une écriture concurrente fait afficher "21 résultats" sur
  // une page qui en contient 20 issus d'un état antérieur.
  const [items, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      select: LIST_SELECT,
      orderBy: [{ featured: 'desc' }, { order: 'asc' }, { year: 'desc' }],
      ...toSkipTake(pagination),
    }),
    prisma.project.count({ where }),
  ])

  return paginate(items, total, pagination)
}

/**
 * Liste publique : uniquement PUBLISHED, mise en cache.
 *
 * L'index composite @@index([status, featured, order]) couvre exactement
 * ce WHERE + ORDER BY — vérifiable par EXPLAIN ANALYZE.
 */
export async function listPublishedProjects() {
  return cached('projects:published', 300, async () =>
    prisma.project.findMany({
      where: { status: 'PUBLISHED' },
      select: PUBLIC_SELECT,
      orderBy: [{ featured: 'desc' }, { order: 'asc' }, { year: 'desc' }],
    }),
  )
}

export async function getProjectBySlug(slug: string) {
  return cached(`project:${slug}`, 300, async () =>
    prisma.project.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: { ...PUBLIC_SELECT, content: true, outcomes: true },
    }),
  )
}

export async function getProjectForAdmin(id: string) {
  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) throw new NotFoundError()
  return project
}

// ─── ÉCRITURES ───────────────────────────────────────────────────────────────

export async function createProject(raw: unknown) {
  const data = parseOrThrow(projectCreateSchema, raw)

  try {
    const project = await prisma.project.create({
      data: {
        ...data,
        links: data.links as Prisma.InputJsonValue,
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
      },
    })

    await afterWrite(project.id)
    return project
  } catch (error) {
    throw translatePrismaError(error, 'Ce slug est déjà utilisé.')
  }
}

export async function updateProject(id: string, raw: unknown) {
  const data = parseOrThrow(projectUpdateSchema, raw)

  try {
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...data,
        ...(data.links ? { links: data.links as Prisma.InputJsonValue } : {}),
        // Première publication : on horodate. Une republication ne réécrit pas la date.
        ...(data.status === 'PUBLISHED' ? { publishedAt: { set: new Date() } } : {}),
      },
    })

    await afterWrite(project.id)
    return project
  } catch (error) {
    throw translatePrismaError(error, 'Ce slug est déjà utilisé.')
  }
}

export async function deleteProject(id: string) {
  try {
    await prisma.project.delete({ where: { id } })
    await afterWrite(id, { removed: true })
  } catch (error) {
    throw translatePrismaError(error, 'Ce slug est déjà utilisé.')
  }
}

// ─── EFFETS DE BORD ──────────────────────────────────────────────────────────

/** Fine couche locale au-dessus du socle partagé : fixe sourceType = PROJECT. */
async function afterWrite(projectId: string, opts: { removed?: boolean } = {}) {
  await afterContentWrite('PROJECT', projectId, opts.removed ?? false)
}
