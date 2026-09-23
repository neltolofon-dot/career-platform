import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth/guard'
import { listExperiencesForAdmin } from '@/lib/services/experiences'
import { paginationSchema } from '@/lib/pagination'
import { ExperienceRowActions } from '@/components/admin/ExperienceRowActions'

export const metadata = { title: 'Expériences', robots: { index: false } }

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' })
}

export default async function AdminExperiencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdminPage()

  const sp = await searchParams
  const pagination = paginationSchema.parse({ page: sp.page, perPage: sp.perPage ?? 20 })
  const { items, page, total, totalPages } = await listExperiencesForAdmin(pagination)

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div>
          <h1 className="display display--section">Expériences</h1>
          <p className="mono" style={{ marginTop: 'var(--space-2)' }}>
            {total} {total > 1 ? 'entrées' : 'entrée'}
          </p>
        </div>
        <Link href="/admin/experiences/new" className="btn btn--primary">
          Nouvelle expérience
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="prose-body" style={{ color: 'var(--color-ink-muted)' }}>
          Aucune expérience pour l’instant. Commencez par en créer une.
        </p>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Période</th>
                <th scope="col">Organisation</th>
                <th scope="col">Rôle</th>
                <th scope="col">Statut</th>
                <th scope="col">Ordre</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td className="mono mono--data">
                    {formatDate(e.startDate)} → {e.current ? 'en cours' : e.endDate ? formatDate(e.endDate) : '—'}
                  </td>
                  <td>
                    <Link href={`/admin/experiences/${e.id}`}>{e.org}</Link>
                  </td>
                  <td className="mono mono--data">{e.role}</td>
                  <td>
                    <span
                      className={`badge ${
                        e.status === 'PUBLISHED' ? 'badge--live' : 'badge--draft'
                      }`}
                    >
                      {e.status === 'PUBLISHED' ? 'En ligne' : 'Brouillon'}
                    </span>
                  </td>
                  <td className="mono mono--data">{e.order}</td>
                  <td style={{ textAlign: 'right' }}>
                    <ExperienceRowActions id={e.id} title={e.org} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <nav
            aria-label="Pagination"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 'var(--space-6)',
            }}
          >
            <span className="mono">
              Page {page} sur {totalPages} · {total} au total
            </span>
            <span style={{ display: 'flex', gap: 'var(--space-4)' }}>
              {page > 1 && (
                <Link className="mono" href={`/admin/experiences?page=${page - 1}`}>
                  ← Précédent
                </Link>
              )}
              {page < totalPages && (
                <Link className="mono" href={`/admin/experiences?page=${page + 1}`}>
                  Suivant →
                </Link>
              )}
            </span>
          </nav>
        </>
      )}
    </div>
  )
}
