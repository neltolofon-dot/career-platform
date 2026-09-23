'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminApi } from '@/lib/auth/guard'
import { reindexAll } from '@/lib/rag/index'

export async function reindexAction() {
  await requireAdminApi()
  await reindexAll()
  revalidatePath('/admin/assistant')
}
