import { z } from 'zod'

/**
 * Le slug est validé par une regex stricte : il finit dans une URL et dans
 * une clé de cache. Un slug libre ouvrirait la porte à des collisions de
 * clés Redis et à des URLs imprévisibles.
 */
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide : minuscules, chiffres et tirets')

/**
 * Toutes les longueurs sont plafonnées. Un champ texte sans max, c'est
 * une requête de 10 Mo qui sature la base et le cache.
 */
export const projectCreateSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(10).max(400),
  content: z.string().trim().max(20_000).default(''),
  role: z.string().trim().min(2).max(120),
  domain: z.string().trim().min(2).max(60),
  year: z.coerce.number().int().min(2000).max(2100),
  stack: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  outcomes: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  links: z
    .object({
      live: z.string().url().max(300).optional().or(z.literal('')),
      repo: z.string().url().max(300).optional().or(z.literal('')),
    })
    .default({}),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  featured: z.boolean().default(false),
  order: z.coerce.number().int().min(0).max(9999).default(0),
  coverId: z.string().cuid().nullable().default(null),
})

/** Sur un PATCH, tous les champs sont optionnels — mais chacun garde sa règle. */
export const projectUpdateSchema = projectCreateSchema.partial()

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>
