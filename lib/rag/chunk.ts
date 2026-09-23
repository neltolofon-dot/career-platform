import { createHash } from 'node:crypto'
import type { KnowledgeSourceType } from '@prisma/client'

export type Chunk = {
  sourceType: KnowledgeSourceType
  sourceId: string
  title: string
  content: string
  contentHash: string
}

/**
 * CHUNKING STRUCTUREL, pas par nombre de caractères.
 *
 * Un découpage aveugle à 500 caractères coupe au milieu d'une phrase et
 * produit des fragments sans contexte : « …utilisé sur ColocBenin et sur »
 * n'aide personne.
 *
 * Ici chaque ENTITÉ produit 1 à 3 chunks sémantiquement complets, chacun
 * PORTANT SON CONTEXTE. Un chunk lu seul reste compréhensible.
 *
 * Deux bénéfices directs :
 *   - les chunks sont CITABLES : on renvoie [PROJECT:koto-cosmetique]
 *     et l'interface affiche une source cliquable
 *   - la réindexation est INCRÉMENTALE : contentHash évite de rappeler
 *     l'API d'embedding quand le contenu n'a pas bougé
 */

function hash(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function mk(
  sourceType: KnowledgeSourceType,
  sourceId: string,
  title: string,
  parts: (string | null | undefined)[],
): Chunk | null {
  const content = parts.filter(Boolean).join('\n').trim()
  if (content.length < 40) return null // trop court pour porter du sens
  return { sourceType, sourceId, title, content, contentHash: hash(content) }
}

export function chunkProject(p: {
  id: string
  slug: string
  title: string
  summary: string
  content: string
  role: string
  domain: string
  year: number
  stack: string[]
  outcomes: string[]
}): Chunk[] {
  const chunks: (Chunk | null)[] = []

  // Chunk 1 — identité du projet. Répond à « quels projets en <domaine> ? »
  chunks.push(
    mk('PROJECT', p.id, p.title, [
      `Projet : ${p.title} (${p.year})`,
      `Domaine : ${p.domain}`,
      `Rôle : ${p.role}`,
      `Technologies : ${p.stack.join(', ')}`,
      p.summary,
    ]),
  )

  // Chunk 2 — résultats. Répond à « qu'est-ce qu'il a obtenu ? »
  if (p.outcomes.length) {
    chunks.push(
      mk('PROJECT', p.id, `${p.title} — résultats`, [
        `Résultats du projet ${p.title} :`,
        ...p.outcomes.map((o) => `- ${o}`),
      ]),
    )
  }

  // Chunk 3 — détail technique. Le markdown est aplati : les caractères
  // de formatage polluent l'embedding sans apporter de sens.
  if (p.content) {
    const flat = p.content
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/[#*`>_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (flat.length > 40) {
      chunks.push(
        mk('PROJECT', p.id, `${p.title} — détails techniques`, [
          `À propos du projet ${p.title} :`,
          flat.slice(0, 4000), // marge sous la limite de 2048 tokens d'entrée
        ]),
      )
    }
  }

  return chunks.filter(Boolean) as Chunk[]
}

export function chunkExperience(e: {
  id: string
  org: string
  role: string
  startDate: Date
  endDate: Date | null
  current: boolean
  summary: string
  highlights: string[]
}): Chunk[] {
  const period = `${e.startDate.getFullYear()} — ${
    e.current ? "aujourd'hui" : (e.endDate?.getFullYear() ?? '')
  }`

  return [
    mk('EXPERIENCE', e.id, `${e.role} — ${e.org}`, [
      `Expérience : ${e.role} chez ${e.org} (${period})`,
      e.summary,
      ...e.highlights.map((h) => `- ${h}`),
    ]),
  ].filter(Boolean) as Chunk[]
}

/**
 * Les compétences sont regroupées PAR CATÉGORIE en un seul chunk.
 *
 * Une compétence isolée (« PHP ») produit un embedding très pauvre.
 * Regroupées avec leur contexte d'usage, elles forment un passage qui
 * répond réellement à « quelle est son expérience en sécurité ? ».
 */
export function chunkSkillGroup(
  category: string,
  skills: { id: string; name: string; context: string | null }[],
): Chunk[] {
  const lines = skills.map((s) => (s.context ? `${s.name} : ${s.context}` : s.name))

  return [
    mk('SKILL', `category:${category}`, `Compétences — ${category}`, [
      `Compétences en ${category} :`,
      ...lines,
    ]),
  ].filter(Boolean) as Chunk[]
}

export function chunkProfile(p: {
  fullName: string
  headline: string
  bio: string
  location: string
  availability: string
  focusNow: string | null
  email: string
}): Chunk[] {
  return [
    mk('PROFILE', 'profile', 'Profil', [
      `${p.fullName}, ${p.location}.`,
      p.headline.replace(/\n/g, ' '),
      p.bio,
    ]),
    mk('PROFILE', 'profile-availability', 'Disponibilité et contact', [
      `Disponibilité : ${p.availability}`,
      p.focusNow ? `Focus actuel : ${p.focusNow}` : null,
      `Contact : ${p.email}`,
      `Localisation : ${p.location}`,
    ]),
  ].filter(Boolean) as Chunk[]
}
