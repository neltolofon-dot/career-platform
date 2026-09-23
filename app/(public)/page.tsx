import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getPublicProfile,
  getPublicProjects,
  getPublicExperiences,
  getPublicSkillsByCategory,
} from '@/lib/services/public'
import { Opening } from '@/components/sections/opening/Opening'
import { Works } from '@/components/sections/works/Works'
import { Trajectory } from '@/components/sections/trajectory/Trajectory'
import { Ground } from '@/components/sections/ground/Ground'

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getPublicProfile()
  if (!profile) return { title: 'Portfolio' }

  // La déclaration contient un saut de ligne pour la mise en page :
  // on le remplace pour les métadonnées et les moteurs de recherche.
  const description = profile.headline.replace(/\n/g, ' ')

  return {
    title: `${profile.fullName} — Développeur full-stack & sécurité`,
    description,
    openGraph: { title: profile.fullName, description, type: 'profile' },
  }
}

/**
 * Page d'accueil — Server Component.
 *
 * Les quatre lectures partent en PARALLÈLE : elles sont indépendantes, et
 * les enchaîner en séquence ajouterait trois aller-retours inutiles au
 * temps de réponse (chacune touche Redis avant Postgres).
 *
 * Aucun sous-composant n'est un Client Component : les animations
 * d'entrée sont en CSS scroll-driven (classe .enter), donc la page
 * n'embarque pratiquement aucun JavaScript.
 */
export default async function HomePage() {
  const [profile, projects, experiences, skillGroups] = await Promise.all([
    getPublicProfile(),
    getPublicProjects(),
    getPublicExperiences(),
    getPublicSkillsByCategory(),
  ])

  if (!profile) notFound()

  return (
    <main>
      <Opening
        headline={profile.headline}
        availability={profile.availability}
        location={profile.location}
        focusNow={profile.focusNow}
        projectCount={projects.length}
      />
      <Works projects={projects} />
      <Trajectory experiences={experiences} />
      <Ground groups={skillGroups} />
      {/* 04 DIALOGUE et 05 CONTACT : blocs suivants */}
    </main>
  )
}
