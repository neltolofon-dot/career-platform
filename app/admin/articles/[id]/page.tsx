import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth/guard'
import { getArticleForAdmin, NotFoundError } from '@/lib/services/articles'
import { ArticleForm } from '@/components/admin/ArticleForm'
import { updateArticleAction } from '../actions'

export const metadata = { title: 'Modifier un article', robots: { index: false } }

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminPage()
  const { id } = await params

  let article
  try {
    article = await getArticleForAdmin(id)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  const action = updateArticleAction.bind(null, id)

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">{article.title}</h1>
      <hr className="rule" style={{ margin: 'var(--space-6) 0' }} />
      <ArticleForm action={action} submitLabel="Enregistrer" article={article} />
    </div>
  )
}
