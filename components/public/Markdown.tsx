import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Rendu markdown SANS dangerouslySetInnerHTML.
 *
 * react-markdown produit des ÉLÉMENTS REACT, pas une chaîne HTML :
 * l'échappement de React s'applique nativement. Il n'y a rien à
 * assainir parce qu'on ne produit jamais de HTML.
 *
 * Volontairement PAS de rehype-raw : autoriser le HTML brut dans le
 * markdown rouvrirait exactement la surface qu'on vient de fermer.
 *
 * Server Component : le coût de la bibliothèque est entièrement côté
 * serveur, zéro octet envoyé au navigateur.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: (props) => (
            <h2
              className="display"
              style={{
                fontSize: 'var(--text-xl)',
                marginTop: 'var(--space-12)',
                marginBottom: 'var(--space-3)',
              }}
              {...props}
            />
          ),
          h3: (props) => (
            <h3
              style={{
                fontSize: 'var(--text-lg)',
                marginTop: 'var(--space-8)',
                marginBottom: 'var(--space-2)',
              }}
              {...props}
            />
          ),
          p: (props) => <p style={{ marginBottom: 'var(--space-4)' }} {...props} />,
          ul: (props) => (
            <ul style={{ paddingLeft: 'var(--space-6)', marginBottom: 'var(--space-4)' }} {...props} />
          ),
          code: (props) => (
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9em',
                background: 'var(--color-surface)',
                padding: '0.1em 0.35em',
              }}
              {...props}
            />
          ),
          // Tout lien externe part en rel="noopener" : sans lui, la page
          // ouverte peut manipuler window.opener (tabnabbing).
          a: ({ href, ...props }) => (
            <a href={href} rel="noopener noreferrer" target="_blank" {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
