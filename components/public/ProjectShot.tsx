import Image from 'next/image'
import { PROJECT_IMAGES } from '@/lib/project-images'

/**
 * Capture du site d'un projet. width/height viennent du pipeline
 * (scripts/optimize-images.mjs) : l'espace est réservé avant chargement,
 * aucun décalage de mise en page ; le LQIP s'affiche pendant ce temps.
 */
export function ProjectShot({ slug, title }: { slug: string; title: string }) {
  const img = PROJECT_IMAGES[slug]
  if (!img) return null

  return (
    <Image
      className="project-shot"
      src={`/images/projects/${slug}.webp`}
      alt={`Capture du site ${title}`}
      width={img.width}
      height={img.height}
      sizes="(max-width: 768px) 100vw, 60vw"
      placeholder="blur"
      blurDataURL={img.blurDataURL}
      // LCP de la page sur mobile (capture dans le premier écran) : préchargée.
      // `preload` remplace `priority`, déprécié en Next 16.
      preload
    />
  )
}
