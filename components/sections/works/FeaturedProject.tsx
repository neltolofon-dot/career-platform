import Image from 'next/image'
import Link from 'next/link'
import { PROJECT_IMAGES } from '@/lib/project-images'

type Project = {
  slug: string
  title: string
  domain: string
  role: string
  year: number
  stack: string[]
  summary: string
  live: string | null
}

export function FeaturedProject({ project, index }: { project: Project; index: number }) {
  const image = PROJECT_IMAGES[project.slug]

  return (
    <article className={`featured-project featured-project--${index + 1}`}>
      {image && (
        <Link
          href={`/travaux/${project.slug}`}
          className="featured-project__visual"
          aria-label={`Découvrir le projet ${project.title}`}
        >
          <Image
            src={`/images/projects/${project.slug}.webp`}
            alt={`Capture du projet ${project.title}`}
            width={image.width}
            height={image.height}
            sizes={index === 0 ? '(max-width: 768px) 100vw, 82vw' : '(max-width: 768px) 100vw, 41vw'}
            placeholder="blur"
            blurDataURL={image.blurDataURL}
          />
        </Link>
      )}

      <div className="featured-project__content">
        <div className="featured-project__meta mono">
          <span>0{index + 1}</span>
          <span>{project.domain}</span>
          <span>{project.year}</span>
        </div>

        <h3 className="featured-project__title display">
          <Link href={`/travaux/${project.slug}`}>{project.title}</Link>
        </h3>

        <p className="featured-project__summary">{project.summary}</p>

        <div className="featured-project__footer">
          <span className="mono mono--data">{project.stack.slice(0, 4).join(' · ')}</span>
          {/* ↗ = sort du portfolio : le titre et l'image mènent à l'étude de cas,
              ce lien mène au site réel. Sans site en ligne, retour à l'étude de cas. */}
          {project.live ? (
            <a href={project.live} className="featured-project__link mono" target="_blank" rel="noopener noreferrer">
              Voir le site<span className="sr-only"> {project.title} (nouvel onglet)</span>
              <span aria-hidden="true">&nbsp;↗</span>
            </a>
          ) : (
            <Link href={`/travaux/${project.slug}`} className="featured-project__link mono">
              Voir le projet <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
