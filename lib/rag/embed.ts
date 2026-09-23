import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export const EMBEDDING_MODEL = 'gemini-embedding-001'
export const EMBEDDING_DIMS = 1536

/**
 * Pourquoi 1536 et pas 3072 (la sortie native) :
 * l'index HNSW de pgvector plafonne à 2000 dimensions pour le type
 * `vector`. Un embedding en 3072 serait stocké mais NON INDEXABLE —
 * la recherche tomberait en scan séquentiel sans la moindre erreur,
 * et ça ne se voit pas sur 200 chunks.
 *
 * Alternative écartée : halfvec(3072), indexable jusqu'à 4000 dims.
 * Coût mémoire équivalent, gain de qualité marginal, complexité en plus.
 */

/**
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  NORMALISATION L2 — LA LIGNE QUI SAUVE LE RAG                    │
 * │                                                                  │
 * │  Gemini ne normalise PAS les sorties tronquées par MRL.          │
 * │  Norme mesurée sur ce projet, en 1536 dims : 0.6922 (≠ 1).       │
 * │                                                                  │
 * │  La distance cosinus suppose des vecteurs unitaires. Sans cette  │
 * │  normalisation, le classement est faux — et le système ne lève   │
 * │  aucune erreur. C'est le type de bug qu'on ne trouve jamais      │
 * │  sans le savoir à l'avance.                                      │
 * └──────────────────────────────────────────────────────────────────┘
 */
export function l2normalize(v: number[]): number[] {
  let sumSq = 0
  for (const x of v) sumSq += x * x
  const norm = Math.sqrt(sumSq)
  return norm === 0 ? v : v.map((x) => x / norm)
}

type TaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

async function embed(text: string, taskType: TaskType): Promise<number[]> {
  const res = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { outputDimensionality: EMBEDDING_DIMS, taskType },
  })

  const values = res.embeddings?.[0]?.values
  if (!values || values.length !== EMBEDDING_DIMS) {
    throw new Error(`Embedding invalide : ${values?.length ?? 0} dimensions`)
  }

  return l2normalize(values)
}

/**
 * taskType asymétrique : DOCUMENT à l'indexation, QUERY à la recherche.
 * Gemini entraîne ces deux espaces pour qu'une QUESTION soit proche des
 * DOCUMENTS qui y répondent — pas des questions qui lui ressemblent.
 * Les inverser dégrade la pertinence, silencieusement.
 */
export const embedDocument = (t: string) => embed(t, 'RETRIEVAL_DOCUMENT')
export const embedQuery = (t: string) => embed(t, 'RETRIEVAL_QUERY')
