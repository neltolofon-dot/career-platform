import { z } from 'zod'

/**
 * Même regex de slug que les projets : il finit dans une URL et dans une
 * clé de cache. `readingMinutes` n'est PAS un champ du formulaire : il est
 * calculé côté serveur à partir de `content` (voir lib/services/articles.ts),
 * jamais saisi par l'admin ni fourni par le client.
 */
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide : minuscules, chiffres et tirets')

export const articleCreateSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(2).max(160),
  excerpt: z.string().trim().min(10).max(300),
  content: z.string().trim().min(1).max(50_000),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  coverId: z.string().cuid().nullable().default(null),
})

/** Sur un PATCH, tous les champs sont optionnels — mais chacun garde sa règle. */
export const articleUpdateSchema = articleCreateSchema.partial()

export type ArticleCreateInput = z.infer<typeof articleCreateSchema>
export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>
