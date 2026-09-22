import { requireAdminPage } from '@/lib/auth/guard'
import { ArticleForm } from '@/components/admin/ArticleForm'
import { createArticleAction } from '../actions'

export const metadata = { title: 'Nouvel article', robots: { index: false } }

export default async function NewArticlePage() {
  await requireAdminPage()

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">Nouvel article</h1>
      <hr className="rule" style={{ margin: 'var(--space-6) 0' }} />
      <ArticleForm action={createArticleAction} submitLabel="Créer" />
    </div>
  )
}
