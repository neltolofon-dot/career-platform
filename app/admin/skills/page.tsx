import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth/guard'
import { listSkillsForAdmin } from '@/lib/services/skills'
import { paginationSchema } from '@/lib/pagination'
import { SkillRowActions } from '@/components/admin/SkillRowActions'

export const metadata = { title: 'Compétences', robots: { index: false } }

export default async function AdminSkillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdminPage()

  const sp = await searchParams
  const pagination = paginationSchema.parse({ page: sp.page, perPage: sp.perPage ?? 20 })
  const { items, page, total, totalPages } = await listSkillsForAdmin(pagination)

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
          <h1 className="display display--section">Compétences</h1>
          <p className="mono" style={{ marginTop: 'var(--space-2)' }}>
            {total} {total > 1 ? 'entrées' : 'entrée'}
          </p>
        </div>
        <Link href="/admin/skills/new" className="btn btn--primary">
          Nouvelle compétence
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="prose-body" style={{ color: 'var(--color-ink-muted)' }}>
          Aucune compétence pour l'instant. Commencez par en créer une.
        </p>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Catégorie</th>
                <th scope="col">Nom</th>
                <th scope="col">Niveau</th>
                <th scope="col">Contexte</th>
                <th scope="col">Ordre</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td className="mono mono--data">{s.category}</td>
                  <td>
                    <Link href={`/admin/skills/${s.id}`}>{s.name}</Link>
                  </td>
                  <td className="mono mono--data">{s.level}</td>
                  <td style={{ maxWidth: '20rem' }}>{s.context}</td>
                  <td className="mono mono--data">{s.order}</td>
                  <td style={{ textAlign: 'right' }}>
                    <SkillRowActions id={s.id} title={s.name} />
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
                <Link className="mono" href={`/admin/skills?page=${page - 1}`}>
                  ← Précédent
                </Link>
              )}
              {page < totalPages && (
                <Link className="mono" href={`/admin/skills?page=${page + 1}`}>
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
