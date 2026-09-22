import { NextResponse, type NextRequest } from 'next/server'

/**
 * ⚠️ CE FICHIER NE FAIT PAS D'AUTORISATION.
 *
 * Next.js 16 a renommé "middleware" en "proxy" précisément pour
 * décourager qu'on y place de la logique applicative : le terme
 * "middleware" faisait croire à un middleware Express. Vercel le
 * documente comme une frontière RÉSEAU devant l'application, tournant
 * en Edge Runtime, séparée de la région de l'app, et recommande de
 * ne l'utiliser qu'en dernier recours.
 *
 * Ce fichier ne regarde que la PRÉSENCE d'un cookie, jamais sa
 * validité — il ne le peut pas : pas d'accès à Prisma depuis l'Edge.
 * Son seul rôle est d'éviter d'afficher une page admin vide à
 * quelqu'un qui n'est manifestement pas connecté.
 *
 * L'autorisation réelle est dans requireAdminPage() / requireAdminApi(),
 * au contact de la donnée. Voir CVE-2026-64642 : une requête forgée
 * pouvait sauter cette couche. Elle ne peut pas sauter un appel de
 * fonction à l'intérieur du composant qui lit la base.
 */

const SESSION_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-session' : 'session'

export function proxy(request: NextRequest) {
  const hasCookie = request.cookies.has(SESSION_COOKIE)

  if (!hasCookie) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

/**
 * IMPORTANT : le matcher ne couvre QUE les pages /admin.
 * Les routes /api/admin/* en sont volontairement exclues — une API doit
 * répondre 401, pas rediriger vers une page HTML. C'est withAdmin() qui
 * s'en charge.
 */
export const config = {
  matcher: ['/admin/:path*'],
}
