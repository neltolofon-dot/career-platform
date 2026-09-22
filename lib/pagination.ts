import { z } from 'zod'

/**
 * Le plafond sur perPage n'est pas du confort : sans lui, ?perPage=999999
 * charge toute la table en mémoire serveur. C'est un déni de service à
 * une seule requête, et le sujet l'exige explicitement.
 *
 * coerce.number() parce qu'un query param est toujours une chaîne.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

export type Pagination = z.infer<typeof paginationSchema>

export type Paginated<T> = {
  items: T[]
  page: number
  perPage: number
  total: number
  totalPages: number
}

export function toSkipTake({ page, perPage }: Pagination) {
  return { skip: (page - 1) * perPage, take: perPage }
}

export function paginate<T>(
  items: T[],
  total: number,
  { page, perPage }: Pagination,
): Paginated<T> {
  return {
    items,
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}
