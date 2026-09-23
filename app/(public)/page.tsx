import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getPublicProfile,
  getPublicProjects,
  getPublicExperiences,
  getPublicSkillsByCategory,
  getPublicServices,
} from '@/lib/services/public'
import { Opening } from '@/components/sections/opening/Opening'
import { Works } from '@/components/sections/works/Works'
import { Trajectory } from '@/components/sections/trajectory/Trajectory'
import { Ground } from '@/components/sections/ground/Ground'
import { Dialogue } from '@/components/sections/dialogue/Dialogue'
import { Contact } from '@/components/sections/contact/Contact'

const DIALOGUE_SUGGESTIONS = [
  'Quels projets pour des clients réels ?',
  'Quelle expérience en cybersécurité ?',
  'Est-il disponible ?',
]

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
 * Les cinq lectures partent en PARALLÈLE : elles sont indépendantes, et
 * les enchaîner en séquence ajouterait quatre aller-retours inutiles au
 * temps de réponse (chacune touche Redis avant Postgres).
 *
 * Deux sous-composants seulement sont des Client Components : ChatPanel
 * et ContactForm (état, saisie, appel réseau). Toutes les animations
 * d'entrée restent en CSS scroll-driven (classe .enter).
 */
export default async function HomePage() {
  const [profile, projects, experiences, skillGroups, services] = await Promise.all([
    getPublicProfile(),
    getPublicProjects(),
    getPublicExperiences(),
    getPublicSkillsByCategory(),
    getPublicServices(),
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
      <Dialogue suggestions={DIALOGUE_SUGGESTIONS} />
      <Contact email={profile.email} availability={profile.availability} services={services} />
    </main>
  )
}
