import { Prisma, type KnowledgeSourceType } from '@prisma/client'
import type { ZodType } from 'zod'
import { bumpCacheVersion } from '@/lib/redis'
import { onContentChanged } from '@/lib/rag/hooks'

/**
 * Socle commun des services. Extrait AVANT de dupliquer le patron sur les
 * autres entités : cinq copies de translatePrismaError, ce sont cinq
 * endroits où corriger un bug de traduction d'erreur.
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

// ─── VALIDATION ──────────────────────────────────────────────────────────────

/**
 * Valide `raw` avec `schema` et lève ValidationError sur échec.
 * Remplace le duo safeParse + if (!success) throw répété dans chaque service.
 */
export function parseOrThrow<T>(schema: ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }
  return parsed.data
}

// ─── EFFETS DE BORD ──────────────────────────────────────────────────────────

/**
 * Deux effets après CHAQUE écriture, centralisés ici pour qu'aucun
 * transport ni aucun service ne puisse les oublier :
 *
 * 1. Invalidation du cache par version — un INCR rend inatteignables
 *    toutes les clés de l'ancienne version, sans SCAN ni DEL en masse.
 * 2. Réindexation RAG — la base de connaissances du chatbot suit le CMS.
 *    Si on l'oublie, le chatbot répond sur des données mortes.
 */
export async function afterContentWrite(
  sourceType: KnowledgeSourceType,
  sourceId: string,
  removed = false,
): Promise<void> {
  await bumpCacheVersion()
  await onContentChanged({ sourceType, sourceId, removed })
}

// ─── ERREURS PRISMA ──────────────────────────────────────────────────────────

/**
 * Traduit les codes Prisma en erreurs métier.
 *
 * C'est ce qui empêche un message Prisma d'atteindre le client : un
 * « Unique constraint failed on the fields: (`slug`) » révèle le nom de
 * mes colonnes et la structure de ma base.
 *
 * `conflictMessage` est paramétrable : la contrainte unique violée n'est
 * pas la même selon l'entité (slug pour projects/articles, [name, category]
 * pour skills…), le message affiché à l'admin doit le refléter.
 */
export function translatePrismaError(
  error: unknown,
  conflictMessage = 'Cette valeur est déjà utilisée.',
): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return new ConflictError(conflictMessage)
    if (error.code === 'P2025') return new NotFoundError()
  }
  return error instanceof Error ? error : new Error('Unknown error')
}
