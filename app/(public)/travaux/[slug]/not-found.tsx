import Link from 'next/link'
import { SectionFrame } from '@/components/primitives/SectionFrame'

export default function ProjectNotFound() {
  return (
    <main>
      <SectionFrame number="404" meta={['Introuvable']} anchor="3-10">
        <h1 className="display display--section">Ce projet n'existe pas</h1>
        <p className="prose-body" style={{ marginTop: 'var(--space-4)' }}>
          Le lien est peut-être périmé, ou le projet n'est plus publié.
        </p>
        <hr className="rule" style={{ margin: 'var(--space-8) 0 var(--space-4)' }} />
        <Link href="/#travaux" className="mono">
          ← Voir tous les travaux
        </Link>
      </SectionFrame>
    </main>
  )
}
