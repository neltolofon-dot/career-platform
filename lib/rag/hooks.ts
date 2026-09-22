import type { KnowledgeSourceType } from '@prisma/client'

/**
 * Point d'accroche de la réindexation RAG.
 *
 * Volontairement défini MAINTENANT, avant le pipeline RAG : les écritures
 * CMS l'appellent déjà, donc quand le bloc 3 l'implémentera, toute la
 * réindexation fonctionnera sans toucher une ligne de la couche service.
 *
 * Il avale ses erreurs : un échec d'embedding ne doit jamais faire échouer
 * la sauvegarde d'un projet. La cohérence de la base de connaissances est
 * rattrapable par un bouton « réindexer » dans l'admin ; la perte du
 * travail de l'utilisateur ne l'est pas.
 */
export type ContentChange = {
  sourceType: KnowledgeSourceType
  sourceId: string
  removed: boolean
}

export async function onContentChanged(change: ContentChange): Promise<void> {
  try {
    // Bloc 3 : chunking → embedding → upsert dans knowledge_chunks
    void change
  } catch (error) {
    console.error(
      JSON.stringify({ level: 'error', scope: 'rag.reindex', error: String(error) }),
    )
  }
}
