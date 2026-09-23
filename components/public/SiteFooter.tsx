import { Mono } from '@/components/primitives/Mono'

export function SiteFooter({
  name,
  email,
  socials,
}: {
  name: string
  email: string
  socials: Record<string, string>
}) {
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <p className="display site-footer__name">{name}</p>
        <Mono>Développement full-stack · sécurité applicative</Mono>
      </div>

      <nav className="site-footer__links" aria-label="Liens de contact">
        <a href={`mailto:${email}`}>{email}</a>
        {Object.entries(socials).map(([key, url]) =>
          url ? <a key={key} href={url} rel="me noopener">{key}</a> : null,
        )}
      </nav>

      <div className="site-footer__bottom">
        <Mono>{name} · {new Date().getFullYear()}</Mono>
        <a href="#ouverture" className="mono">Retour en haut ↑</a>
      </div>
    </footer>
  )
}
