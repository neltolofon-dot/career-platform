import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { cached } from '@/lib/redis'

/**
 * Lectures publiques, toutes passées par le cache versionné.
 *
 * Une écriture admin incrémente {ENV}:portfolio:version, ce qui rend
 * inatteignables toutes les clés de l'ancienne version d'un coup —
 * aucune clé à lister, aucune à oublier.
 *
 * TTL de 300 s : même sans écriture, le cache se rafraîchit seul,
 * ce qui borne la casse en cas d'invalidation manquée.
 */

export async function getPublicProfile() {
  return cached('profile', 300, async () =>
    prisma.profile.findUnique({
      where: { id: 'profile' },
      select: {
        fullName: true,
        headline: true,
        bio: true,
        location: true,
        timezone: true,
        email: true,
        availability: true,
        focusNow: true,
        openToWork: true,
        socials: true,
      },
    }),
  )
}

/** Domaines des projets publiés, avec leur effectif : liste blanche du filtre. */
export async function getPublicDomains() {
  return cached('projects:domains', 300, async () => {
    const rows = await prisma.project.groupBy({
      by: ['domain'],
      where: { status: 'PUBLISHED' },
      _count: { _all: true },
      orderBy: { domain: 'asc' },
    })
    return rows.map((r) => ({ name: r.domain, count: r._count._all }))
  })
}

/**
 * Le paramètre d'URL `domaine` est une entrée utilisateur : validé par Zod
 * contre la liste blanche des domaines EXISTANTS. Toute autre valeur (inconnue,
 * répétée, vide) vaut « Tous » — jamais une erreur, jamais une requête libre.
 */
export async function resolveDomain(raw: unknown): Promise<string | null> {
  if (raw === undefined) return null
  const names = (await getPublicDomains()).map((d) => d.name)
  if (names.length === 0) return null
  const parsed = z.enum(names as [string, ...string[]]).safeParse(raw)
  return parsed.success ? parsed.data : null
}

export async function getPublicProjects(rawDomain?: unknown) {
  const domain = await resolveDomain(rawDomain)

  // Une clé par domaine : le cache d'un filtre ne sert jamais un autre filtre.
  return cached(domain ? `projects:published:${domain}` : 'projects:published', 300, async () =>
    prisma.project.findMany({
      where: { status: 'PUBLISHED', ...(domain ? { domain } : {}) },
      select: {
        slug: true,
        title: true,
        domain: true,
        role: true,
        year: true,
        stack: true,
        summary: true,
        featured: true,
      },
      // Couvert par @@index([status, featured, order]) — vérifiable
      // par EXPLAIN ANALYZE, cf. PERFORMANCE.md
      orderBy: [{ featured: 'desc' }, { order: 'asc' }, { year: 'desc' }],
    }),
  )
}

export async function getPublicProject(slug: string) {
  return cached(`project:${slug}`, 300, async () =>
    prisma.project.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: {
        slug: true,
        title: true,
        domain: true,
        role: true,
        year: true,
        stack: true,
        summary: true,
        content: true,
        outcomes: true,
        links: true,
      },
    }),
  )
}

export async function getPublicExperiences() {
  const experiences = await cached('experiences', 300, async () =>
    prisma.experience.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        org: true,
        role: true,
        location: true,
        startDate: true,
        endDate: true,
        current: true,
        summary: true,
        highlights: true,
      },
      orderBy: [{ order: 'asc' }, { startDate: 'desc' }],
    }),
  )

  // cached() passe par Redis : sur un hit, startDate/endDate reviennent en
  // chaînes ISO (JSON n'a pas de type Date), pas en Date. Les composants
  // appellent .getFullYear() dessus — sans cette ré-hydratation, un hit de
  // cache fait planter la page (une miss sur deux, donc intermittent).
  return experiences.map((e) => ({
    ...e,
    startDate: new Date(e.startDate),
    endDate: e.endDate ? new Date(e.endDate) : null,
  }))
}

/**
 * Regroupées par catégorie côté serveur : le composant reçoit une
 * structure prête à afficher et n'a aucune logique.
 */
export async function getPublicSkillsByCategory() {
  const skills = await cached('skills', 300, async () =>
    prisma.skill.findMany({
      select: { name: true, category: true, context: true },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    }),
  )

  const grouped = new Map<string, { name: string; context: string | null }[]>()
  for (const s of skills) {
    const list = grouped.get(s.category) ?? []
    list.push({ name: s.name, context: s.context })
    grouped.set(s.category, list)
  }

  return Array.from(grouped, ([category, items]) => ({ category, items }))
}

export async function getPublicServices() {
  return cached('services:active', 300, async () =>
    prisma.service.findMany({
      where: { active: true },
      select: { slug: true, name: true, durationMin: true },
      orderBy: { order: 'asc' },
    }),
  )
}
