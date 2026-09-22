import { NextResponse, type NextRequest } from 'next/server'

/**
 * ⚠️ CE FICHIER NE FAIT PAS D'AUTORISATION.
 *
 * Il ne regarde que la PRÉSENCE d'un cookie, jamais sa validité — il ne
 * peut pas : le middleware tourne en Edge runtime, sans accès à Prisma.
 *
 * Son seul rôle est le confort : éviter d'afficher une page admin vide à
 * quelqu'un qui n'est manifestement pas connecté.
 *
 * L'autorisation réelle est dans requireAdminPage() / requireAdminApi(),
 * appelées au contact de la donnée. Voir CVE-2026-64642 : une requête
 * forgée peut sauter ce middleware. Elle ne peut pas sauter un appel de
 * fonction à l'intérieur du composant qui lit la base.
 */

const SESSION_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-session' : 'session'

export function middleware(request: NextRequest) {
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
