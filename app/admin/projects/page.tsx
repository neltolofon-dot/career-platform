import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth/guard'
import { listProjectsForAdmin } from '@/lib/services/projects'
import { paginationSchema } from '@/lib/pagination'
import { ProjectRowActions } from '@/components/admin/ProjectRowActions'

export const metadata = { title: 'Projets', robots: { index: false } }

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdminPage() // première ligne, toujours

  const sp = await searchParams
  const pagination = paginationSchema.parse({ page: sp.page, perPage: sp.perPage ?? 20 })
  const { items, page, total, totalPages } = await listProjectsForAdmin(pagination)

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
          <h1 className="display display--section">Projets</h1>
          <p className="mono" style={{ marginTop: 'var(--space-2)' }}>
            {total} {total > 1 ? 'entrées' : 'entrée'}
          </p>
        </div>
        <Link href="/admin/projects/new" className="btn btn--primary">
          Nouveau projet
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="prose-body" style={{ color: 'var(--color-ink-muted)' }}>
          Aucun projet pour l'instant. Commencez par en créer un.
        </p>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Année</th>
                <th scope="col">Titre</th>
                <th scope="col">Domaine</th>
                <th scope="col">Statut</th>
                <th scope="col">Ordre</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="mono mono--data">{p.year}</td>
                  <td>
                    <Link href={`/admin/projects/${p.id}`}>{p.title}</Link>
                    {p.featured && (
                      <span className="badge badge--urgent" style={{ marginLeft: 8 }}>
                        Mis en avant
                      </span>
                    )}
                  </td>
                  <td className="mono mono--data">{p.domain}</td>
                  <td>
                    <span
                      className={`badge ${
                        p.status === 'PUBLISHED' ? 'badge--live' : 'badge--draft'
                      }`}
                    >
                      {p.status === 'PUBLISHED' ? 'En ligne' : 'Brouillon'}
                    </span>
                  </td>
                  <td className="mono mono--data">{p.order}</td>
                  <td style={{ textAlign: 'right' }}>
                    <ProjectRowActions id={p.id} title={p.title} />
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
                <Link className="mono" href={`/admin/projects?page=${page - 1}`}>
                  ← Précédent
                </Link>
              )}
              {page < totalPages && (
                <Link className="mono" href={`/admin/projects?page=${page + 1}`}>
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
