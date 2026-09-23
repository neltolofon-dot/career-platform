import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth/guard'
import { listArticlesForAdmin } from '@/lib/services/articles'
import { paginationSchema } from '@/lib/pagination'
import { ArticleRowActions } from '@/components/admin/ArticleRowActions'

export const metadata = { title: 'Articles', robots: { index: false } }

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdminPage()

  const sp = await searchParams
  const pagination = paginationSchema.parse({ page: sp.page, perPage: sp.perPage ?? 20 })
  const { items, page, total, totalPages } = await listArticlesForAdmin(pagination)

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
          <h1 className="display display--section">Articles</h1>
          <p className="mono" style={{ marginTop: 'var(--space-2)' }}>
            {total} {total > 1 ? 'entrées' : 'entrée'}
          </p>
        </div>
        <Link href="/admin/articles/new" className="btn btn--primary">
          Nouvel article
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="prose-body" style={{ color: 'var(--color-ink-muted)' }}>
          Aucun article pour l’instant. Commencez par en créer un.
        </p>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Titre</th>
                <th scope="col">Statut</th>
                <th scope="col">Lecture</th>
                <th scope="col">Tags</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/admin/articles/${a.id}`}>{a.title}</Link>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        a.status === 'PUBLISHED' ? 'badge--live' : 'badge--draft'
                      }`}
                    >
                      {a.status === 'PUBLISHED' ? 'En ligne' : 'Brouillon'}
                    </span>
                  </td>
                  <td className="mono mono--data">{a.readingMinutes} min</td>
                  <td className="mono mono--data">{a.tags.join(', ')}</td>
                  <td style={{ textAlign: 'right' }}>
                    <ArticleRowActions id={a.id} title={a.title} />
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
                <Link className="mono" href={`/admin/articles?page=${page - 1}`}>
                  ← Précédent
                </Link>
              )}
              {page < totalPages && (
                <Link className="mono" href={`/admin/articles?page=${page + 1}`}>
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
