import { cancelByToken } from '@/lib/services/booking'
import { NotFoundError } from '@/lib/services/_shared'
import { SectionFrame } from '@/components/primitives/SectionFrame'
import { CancelButton } from '@/components/booking/CancelButton'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * L'annulation se fait par un token opaque, pas par un identifiant de
 * rendez-vous : personne ne peut annuler le rendez-vous d'un autre en
 * incrémentant un nombre dans l'URL.
 *
 * L'annulation elle-même passe par une Server Action (POST), jamais par
 * le simple chargement de la page : un GET ne doit pas modifier d'état —
 * sinon un aperçu de lien dans une messagerie annulerait le rendez-vous.
 */
export default async function CancelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const appointment = await prisma.appointment.findUnique({
    where: { cancelToken: token },
    select: {
      startsAt: true,
      status: true,
      service: { select: { name: true } },
    },
  })

  if (!appointment) notFound()

  const cancelled = appointment.status === 'CANCELLED'

  return (
    <main>
      <SectionFrame number="RDV" meta={['Annulation']} anchor="3-10">
        <h1 className="display display--section">
          {cancelled ? 'Rendez-vous annulé' : 'Annuler ce rendez-vous ?'}
        </h1>

        <p className="prose-body" style={{ marginTop: 'var(--space-4)' }}>
          {appointment.service.name} — {appointment.startsAt.toLocaleString('fr-FR')}
        </p>

        {!cancelled && (
          <div style={{ marginTop: 'var(--space-8)' }}>
            <CancelButton token={token} />
          </div>
        )}
      </SectionFrame>
    </main>
  )
}

export async function cancelAction(token: string) {
  'use server'
  try {
    await cancelByToken(token)
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error
  }
}
