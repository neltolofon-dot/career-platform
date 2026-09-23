import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { embedDocument, EMBEDDING_DIMS } from './embed'
import {
  chunkProject,
  chunkExperience,
  chunkSkillGroup,
  chunkProfile,
  type Chunk,
} from './chunk'

/**
 * Prisma ne connaît pas le type `vector` : le champ est déclaré
 * Unsupported() et reste invisible au client généré. Toute écriture ou
 * lecture de l'embedding passe donc par $queryRaw / $executeRaw avec un
 * cast ::vector. C'est assumé et documenté — le prix de pgvector + Prisma.
 *
 * Le paramétrage reste strict : $executeRaw avec interpolation balisée
 * produit une requête PRÉPARÉE, pas une concaténation. Aucune injection
 * possible. (Ne jamais passer à $executeRawUnsafe.)
 *
 * Exception ciblée : le modificateur de type dans vector(1536) doit être
 * du SQL littéral — Postgres refuse un paramètre lié à cette position
 * (« type modifiers must be simple constants or identifiers », 42601).
 * Prisma.raw(String(EMBEDDING_DIMS)) inline la constante en toute
 * sécurité : elle vient du code, jamais d'une entrée utilisateur.
 */

/**
 * Une entité (un projet, par exemple) peut produire PLUSIEURS chunks
 * partageant le même (sourceType, sourceId) — identité, résultats, détails
 * techniques. Le remplacement doit donc se faire UNE FOIS PAR ENTITÉ, sur
 * l'ensemble de ses chunks, jamais chunk par chunk : un delete scopé par
 * (sourceType, sourceId) à l'intérieur d'une boucle sur les chunks efface
 * les frères siblings tout juste insérés dans la même exécution — la
 * réindexation se termine sans erreur avec deux chunks sur trois disparus
 * par projet. Exactement le genre de bug que ce module dénonce partout
 * ailleurs : silencieux, et invisible sans compter les lignes en base.
 */
async function upsertEntityChunks(
  entityChunks: Chunk[],
): Promise<{ written: number; skipped: number }> {
  const [{ sourceType, sourceId }] = entityChunks

  const existing = await prisma.knowledgeChunk.findMany({
    where: { sourceType, sourceId },
    select: { contentHash: true },
  })
  const existingHashes = new Set(existing.map((c) => c.contentHash))
  const freshHashes = new Set(entityChunks.map((c) => c.contentHash))

  // Réindexation incrémentale : si l'ENSEMBLE des chunks de l'entité est
  // identique à ce qui existe déjà, les embeddings restent valides — on
  // évite un appel API payant par chunk.
  const unchanged =
    existingHashes.size === freshHashes.size &&
    [...freshHashes].every((h) => existingHashes.has(h))
  if (unchanged) return { written: 0, skipped: entityChunks.length }

  await prisma.knowledgeChunk.deleteMany({ where: { sourceType, sourceId } })

  for (const chunk of entityChunks) {
    const vector = await embedDocument(chunk.content)
    const literal = `[${vector.join(',')}]`

    await prisma.$executeRaw`
      INSERT INTO knowledge_chunks
        (id, "sourceType", "sourceId", title, content, "tokenCount",
         "contentHash", embedding, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid()::text,
        ${chunk.sourceType}::"KnowledgeSourceType",
        ${chunk.sourceId},
        ${chunk.title},
        ${chunk.content},
        ${Math.ceil(chunk.content.length / 4)},
        ${chunk.contentHash},
        ${literal}::vector(${Prisma.raw(String(EMBEDDING_DIMS))}),
        NOW(), NOW()
      )
    `
  }

  return { written: entityChunks.length, skipped: 0 }
}

/** Réindexe TOUT le contenu publié. Bouton « Réindexer » de l'admin. */
export async function reindexAll(): Promise<{
  written: number
  skipped: number
  total: number
}> {
  const chunks: Chunk[] = []

  const profile = await prisma.profile.findUnique({ where: { id: 'profile' } })
  if (profile) chunks.push(...chunkProfile(profile))

  const projects = await prisma.project.findMany({ where: { status: 'PUBLISHED' } })
  for (const p of projects) chunks.push(...chunkProject(p))

  const experiences = await prisma.experience.findMany({ where: { status: 'PUBLISHED' } })
  for (const e of experiences) chunks.push(...chunkExperience(e))

  const skills = await prisma.skill.findMany({ orderBy: { order: 'asc' } })
  const byCategory = new Map<string, typeof skills>()
  for (const s of skills) {
    byCategory.set(s.category, [...(byCategory.get(s.category) ?? []), s])
  }
  for (const [category, list] of byCategory) {
    chunks.push(...chunkSkillGroup(category, list))
  }

  // Regroupement par entité : upsertEntityChunks() doit voir TOUS les
  // chunks d'une même (sourceType, sourceId) ensemble, pas un par un.
  const byEntity = new Map<string, Chunk[]>()
  for (const chunk of chunks) {
    const key = `${chunk.sourceType}:${chunk.sourceId}`
    byEntity.set(key, [...(byEntity.get(key) ?? []), chunk])
  }

  let written = 0
  let skipped = 0

  // Séquentiel volontaire : le tier gratuit de Gemini limite le débit,
  // et une réindexation complète n'est pas un chemin critique.
  for (const entityChunks of byEntity.values()) {
    const r = await upsertEntityChunks(entityChunks)
    written += r.written
    skipped += r.skipped
  }

  // Nettoyage des chunks dont l'entité d'origine a disparu.
  await pruneOrphans()

  return { written, skipped, total: chunks.length }
}

async function pruneOrphans() {
  const [projectIds, experienceIds] = await Promise.all([
    prisma.project.findMany({ where: { status: 'PUBLISHED' }, select: { id: true } }),
    prisma.experience.findMany({ where: { status: 'PUBLISHED' }, select: { id: true } }),
  ])

  await prisma.knowledgeChunk.deleteMany({
    where: {
      OR: [
        { sourceType: 'PROJECT', sourceId: { notIn: projectIds.map((p) => p.id) } },
        { sourceType: 'EXPERIENCE', sourceId: { notIn: experienceIds.map((e) => e.id) } },
      ],
    },
  })
}

export async function countChunks() {
  return prisma.knowledgeChunk.count()
}

export async function lastIndexedAt() {
  const last = await prisma.knowledgeChunk.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  })
  return last?.updatedAt ?? null
}
