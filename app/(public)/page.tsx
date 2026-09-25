import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getPublicProfile,
  getPublicProjects,
  getPublicExperiences,
  getPublicSkillsByCategory,
  getPublicServices,
  getPublicDomains,
  resolveDomain,
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
    // Nécessaire pour qu'og:image soit une URL ABSOLUE : les réseaux sociaux
    // n'interprètent pas un chemin relatif.
    metadataBase: new URL('https://career-platform-pied.vercel.app'),
    title: `${profile.fullName} — Développeur full-stack & sécurité`,
    description,
    openGraph: {
      title: profile.fullName,
      description,
      type: 'profile',
      images: [{ url: '/portrait.webp', width: 1046, height: 1100, alt: profile.fullName }],
    },
  }
}

/**
 * Page d'accueil — Server Component.
 *
 * Les lectures partent en PARALLÈLE : elles sont indépendantes, et les
 * enchaîner en séquence ajouterait autant d'aller-retours inutiles au
 * temps de réponse (chacune touche Redis avant Postgres).
 *
 * Le filtre des travaux passe par l'URL (?domaine=…) et s'applique côté
 * serveur : partageable, indexable, sans JavaScript client.
 *
 * Deux sous-composants seulement sont des Client Components : ChatPanel
 * et ContactForm (état, saisie, appel réseau). Toutes les animations
 * d'entrée restent en CSS scroll-driven (classe .enter).
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { domaine } = await searchParams

  const [profile, projects, experiences, skillGroups, services, domains, activeDomain] =
    await Promise.all([
      getPublicProfile(),
      getPublicProjects(domaine),
      getPublicExperiences(),
      getPublicSkillsByCategory(),
      getPublicServices(),
      getPublicDomains(),
      resolveDomain(domaine),
    ])

  if (!profile) notFound()

  // Total publié, indépendant du filtre : l'Ouverture ne doit pas dire « 1 projets ».
  const totalProjects = domains.reduce((n, d) => n + d.count, 0)

  return (
    <main className="public-main">
      <Opening
        headline={profile.headline}
        availability={profile.availability}
        location={profile.location}
        focusNow={profile.focusNow}
        projectCount={totalProjects}
      />
      <Works projects={projects} domains={domains} activeDomain={activeDomain} />
      <Trajectory experiences={experiences} />
      <Ground groups={skillGroups} />
      <Dialogue suggestions={DIALOGUE_SUGGESTIONS} />
      <Contact email={profile.email} availability={profile.availability} services={services} />
    </main>
  )
}
