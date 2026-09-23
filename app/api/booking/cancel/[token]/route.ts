import { cancelByToken } from '@/lib/services/booking'
import { NotFoundError } from '@/lib/services/_shared'

export const runtime = 'nodejs'

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  try {
    await cancelByToken(token)
    return Response.json({ ok: true })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return Response.json({ error: 'Introuvable' }, { status: 404 })
    }
    throw error
  }
}

// GET interdit : une annulation ne doit pas se déclencher au simple
// chargement d'une URL (aperçu de lien, préchargement navigateur…).
export const GET = () => new Response(null, { status: 405, headers: { Allow: 'POST' } })
