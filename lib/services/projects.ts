import { Prisma, type ContentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { bumpCacheVersion, cached } from '@/lib/redis'
import {
  projectCreateSchema,
  projectUpdateSchema,
  type ProjectCreateInput,
  type ProjectUpdateInput,
} from '@/lib/validation/project'
import {
  paginate,
  toSkipTake,
  type Pagination,
  type Paginated,
} from '@/lib/pagination'
import { onContentChanged } from '@/lib/rag/hooks'

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

// ─── ERREURS MÉTIER TYPÉES ───────────────────────────────────────────────────

/**
 * Erreurs typées plutôt que des chaînes : chaque transport décide comment
 * les rendre (JSON + statut pour l'API, état de formulaire pour l'admin),
 * sans jamais exposer un message Prisma brut au client.
 */
export class ValidationError extends Error {
  constructor(public readonly fields: Record<string, string[]>) {
    super('Validation failed')
    this.name = 'ValidationError'
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class NotFoundError extends Error {
  constructor() {
    super('Not found')
    this.name = 'NotFoundError'
  }
}

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
  const parsed = projectCreateSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

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
    throw translatePrismaError(error)
  }
}

export async function updateProject(id: string, raw: unknown) {
  const parsed = projectUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

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
    throw translatePrismaError(error)
  }
}

export async function deleteProject(id: string) {
  try {
    await prisma.project.delete({ where: { id } })
    await afterWrite(id, { removed: true })
  } catch (error) {
    throw translatePrismaError(error)
  }
}

// ─── EFFETS DE BORD ──────────────────────────────────────────────────────────

/**
 * Deux effets après CHAQUE écriture, centralisés ici pour qu'aucun
 * transport ne puisse les oublier :
 *
 * 1. Invalidation du cache par version — un INCR rend inatteignables
 *    toutes les clés de l'ancienne version, sans SCAN ni DEL en masse.
 * 2. Réindexation RAG — la base de connaissances du chatbot suit le CMS.
 *    Si on l'oublie, le chatbot répond sur des données mortes.
 */
async function afterWrite(projectId: string, opts: { removed?: boolean } = {}) {
  await bumpCacheVersion()
  await onContentChanged({
    sourceType: 'PROJECT',
    sourceId: projectId,
    removed: opts.removed ?? false,
  })
}

/**
 * Traduit les codes Prisma en erreurs métier.
 *
 * C'est ce qui empêche un message Prisma d'atteindre le client : un
 * « Unique constraint failed on the fields: (`slug`) » révèle le nom de
 * mes colonnes et la structure de ma base.
 */
function translatePrismaError(error: unknown): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return new ConflictError('Ce slug est déjà utilisé.')
    if (error.code === 'P2025') return new NotFoundError()
  }
  return error instanceof Error ? error : new Error('Unknown error')
}
