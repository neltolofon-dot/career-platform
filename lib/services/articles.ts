import { Prisma, type ContentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { cached } from '@/lib/redis'
import { articleCreateSchema, articleUpdateSchema } from '@/lib/validation/article'
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
 * Patron de lib/services/projects.ts, répliqué. Particularité : readingMinutes
 * n'est jamais accepté en entrée, il est recalculé à chaque écriture à partir
 * de `content` — un client ne peut pas mentir sur le temps de lecture affiché.
 */
export { ValidationError, ConflictError, NotFoundError }

const WORDS_PER_MINUTE = 200

/**
 * Exportée pour que prisma/seed.ts calcule le même temps de lecture sur le
 * contenu réel — une seule formule, jamais deux copies de « 200 mots/minute ».
 */
export function computeReadingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}

const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  status: true,
  readingMinutes: true,
  tags: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.ArticleSelect

const PUBLIC_SELECT = {
  ...LIST_SELECT,
  excerpt: true,
  cover: { select: { url: true, alt: true, width: true, height: true, blurDataUrl: true } },
} satisfies Prisma.ArticleSelect

// ─── LECTURES ────────────────────────────────────────────────────────────────

/** Liste admin : tous statuts confondus, paginée, la plus récente d'abord. */
export async function listArticlesForAdmin(
  pagination: Pagination,
  filters: { status?: ContentStatus } = {},
): Promise<Paginated<Prisma.ArticleGetPayload<{ select: typeof LIST_SELECT }>>> {
  const where: Prisma.ArticleWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.article.findMany({
      where,
      select: LIST_SELECT,
      orderBy: [{ createdAt: 'desc' }],
      ...toSkipTake(pagination),
    }),
    prisma.article.count({ where }),
  ])

  return paginate(items, total, pagination)
}

/** Liste publique : uniquement PUBLISHED. Couverte par @@index([status, publishedAt]). */
export async function listPublishedArticles() {
  return cached('articles:published', 300, async () =>
    prisma.article.findMany({
      where: { status: 'PUBLISHED' },
      select: PUBLIC_SELECT,
      orderBy: [{ publishedAt: 'desc' }],
    }),
  )
}

export async function getArticleBySlug(slug: string) {
  return cached(`article:${slug}`, 300, async () =>
    prisma.article.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: { ...PUBLIC_SELECT, content: true },
    }),
  )
}

export async function getArticleForAdmin(id: string) {
  const article = await prisma.article.findUnique({ where: { id } })
  if (!article) throw new NotFoundError()
  return article
}

// ─── ÉCRITURES ───────────────────────────────────────────────────────────────

const CONFLICT_MESSAGE = 'Ce slug est déjà utilisé.'

export async function createArticle(raw: unknown) {
  const data = parseOrThrow(articleCreateSchema, raw)

  try {
    const article = await prisma.article.create({
      data: {
        ...data,
        readingMinutes: computeReadingMinutes(data.content),
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
      },
    })

    await afterWrite(article.id)
    return article
  } catch (error) {
    throw translatePrismaError(error, CONFLICT_MESSAGE)
  }
}

export async function updateArticle(id: string, raw: unknown) {
  const data = parseOrThrow(articleUpdateSchema, raw)

  try {
    const article = await prisma.article.update({
      where: { id },
      data: {
        ...data,
        ...(data.content ? { readingMinutes: computeReadingMinutes(data.content) } : {}),
        // Première publication : on horodate. Une republication ne réécrit pas la date.
        ...(data.status === 'PUBLISHED' ? { publishedAt: { set: new Date() } } : {}),
      },
    })

    await afterWrite(article.id)
    return article
  } catch (error) {
    throw translatePrismaError(error, CONFLICT_MESSAGE)
  }
}

export async function deleteArticle(id: string) {
  try {
    await prisma.article.delete({ where: { id } })
    await afterWrite(id, { removed: true })
  } catch (error) {
    throw translatePrismaError(error, CONFLICT_MESSAGE)
  }
}

// ─── EFFETS DE BORD ──────────────────────────────────────────────────────────

async function afterWrite(articleId: string, opts: { removed?: boolean } = {}) {
  await afterContentWrite('ARTICLE', articleId, opts.removed ?? false)
}
