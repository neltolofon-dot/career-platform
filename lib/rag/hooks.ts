import type { KnowledgeSourceType } from '@prisma/client'
import { reindexAll } from './index'

export type ContentChange = {
  sourceType: KnowledgeSourceType
  sourceId: string
  removed: boolean
}

/**
 * Appelé après CHAQUE écriture CMS, via afterContentWrite().
 *
 * Il AVALE ses erreurs, volontairement : un échec d'embedding ne doit
 * jamais faire échouer la sauvegarde d'un projet. Une base de
 * connaissances en retard se rattrape par le bouton « Réindexer » ;
 * le travail perdu d'un utilisateur, non.
 *
 * DETTE ASSUMÉE : la réindexation est synchrone, ce qui ajoute ~800 ms
 * à une sauvegarde. Documenté dans ARCHITECTURE.md comme première des
 * trois améliorations en +24 h (file d'attente et traitement différé).
 */
export async function onContentChanged(change: ContentChange): Promise<void> {
  try {
    await reindexAll()
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        scope: 'rag.reindex',
        sourceType: change.sourceType,
        error: String(error),
      }),
    )
  }
}
