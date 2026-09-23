import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { embedQuery, EMBEDDING_DIMS } from './embed'

// vector(1536) : le modificateur de type doit être du SQL littéral, pas un
// paramètre lié — voir le commentaire équivalent dans lib/rag/index.ts.
const VECTOR_TYPE = Prisma.raw(String(EMBEDDING_DIMS))

export type Hit = {
  id: string
  sourceType: string
  sourceId: string
  title: string
  content: string
  score: number
}

/**
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  RECHERCHE HYBRIDE — vectorielle + lexicale, fusionnées par RRF      │
 * │                                                                      │
 * │  Pourquoi pas seulement du vectoriel : les embeddings représentent   │
 * │  mal les NOMS PROPRES et les ACRONYMES. « HECM », « KÔTÔ »,          │
 * │  « pgvector », « Wireshark » — exactement ce qu'un recruteur tape.   │
 * │                                                                      │
 * │  La branche lexicale (tsvector français) les trouve exactement.      │
 * │  La branche vectorielle trouve les reformulations.                   │
 * │  RRF fusionne les deux sans avoir à calibrer un poids arbitraire.    │
 * └──────────────────────────────────────────────────────────────────────┘
 */

const RRF_K = 60 // constante standard de la littérature RRF
const CANDIDATES = 20
const TOP_K = 6

/**
 * SEUIL DE PERTINENCE.
 *
 * Score RRF maximal théorique : 1/(60+1) × 2 ≈ 0.0328 (1er des deux listes).
 * En dessous de 0.016, le meilleur résultat n'est bien classé dans
 * AUCUNE des deux branches → on considère qu'on n'a pas l'information.
 *
 * À calibrer en observant les scores réels (voir le script de test).
 *
 * LIMITE MESURÉE : le rang 1 vectoriel vaut à lui seul 1/61 ≈ 0.0164 > 0.016,
 * quelle que soit sa pertinence — ce seuil ne refuse donc jamais tant qu'un
 * chunk existe. Le vrai garde-fou est MAX_COSINE_DISTANCE (lib/rag/answer.ts).
 */
export const RELEVANCE_THRESHOLD = 0.016

type RawRow = { id: string; rank: number }
type VectorRow = RawRow & { distance: number }

export type SearchResult = {
  hits: Hit[]
  /**
   * Distance cosinus (pgvector <=>, 0 = identique, 2 = opposé) du chunk le
   * plus proche. Contrairement au score RRF — qui note un RANG et donne
   * toujours ≈ 0.0164 au 1er, pertinent ou non — c'est une mesure ABSOLUE
   * de proximité. Infinity si aucun chunk n'a d'embedding.
   */
  bestDistance: number
}

export async function hybridSearch(question: string): Promise<SearchResult> {
  const queryVector = await embedQuery(question)
  const literal = `[${queryVector.join(',')}]`

  // Les deux recherches partent en parallèle : elles sont indépendantes.
  const [vectorRows, lexicalRows] = await Promise.all([
    prisma.$queryRaw<VectorRow[]>`
      SELECT id,
             (embedding <=> ${literal}::vector(${VECTOR_TYPE})) AS distance,
             ROW_NUMBER() OVER (ORDER BY embedding <=> ${literal}::vector(${VECTOR_TYPE})) AS rank
      FROM knowledge_chunks
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${literal}::vector(${VECTOR_TYPE})
      LIMIT ${CANDIDATES}
    `,
    prisma.$queryRaw<RawRow[]>`
      SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(tsv, q) DESC) AS rank
      FROM knowledge_chunks, websearch_to_tsquery('french', ${question}) q
      WHERE tsv @@ q
      ORDER BY ts_rank_cd(tsv, q) DESC
      LIMIT ${CANDIDATES}
    `,
  ])

  // ── Reciprocal Rank Fusion ──
  // score(d) = Σ 1/(k + rang_d_dans_liste)
  //
  // RRF fusionne des CLASSEMENTS, pas des scores. C'est ce qui permet de
  // combiner une distance cosinus et un ts_rank sans les normaliser ni
  // choisir un poids arbitraire entre les deux — le classement suffit.
  const scores = new Map<string, number>()

  for (const row of vectorRows) {
    scores.set(row.id, (scores.get(row.id) ?? 0) + 1 / (RRF_K + Number(row.rank)))
  }
  for (const row of lexicalRows) {
    scores.set(row.id, (scores.get(row.id) ?? 0) + 1 / (RRF_K + Number(row.rank)))
  }

  // Liste triée par distance croissante : le premier est le plus proche.
  const bestDistance = vectorRows.length ? Number(vectorRows[0].distance) : Infinity

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_K)

  if (ranked.length === 0) return { hits: [], bestDistance }

  const chunks = await prisma.knowledgeChunk.findMany({
    where: { id: { in: ranked.map(([id]) => id) } },
    select: { id: true, sourceType: true, sourceId: true, title: true, content: true },
  })

  const byId = new Map(chunks.map((c) => [c.id, c]))

  const hits = ranked
    .map(([id, score]) => {
      const c = byId.get(id)
      return c ? { ...c, score } : null
    })
    .filter(Boolean) as Hit[]

  return { hits, bestDistance }
}
