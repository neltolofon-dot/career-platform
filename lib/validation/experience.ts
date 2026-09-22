import { z } from 'zod'

/**
 * Pas de slug ici : une expérience n'a pas de page dédiée, elle n'apparaît
 * que dans la chronologie. Toutes les longueurs restent plafonnées pour la
 * même raison que sur les projets : un champ texte sans max est un déni de
 * service à une requête.
 */
export const experienceCreateSchema = z.object({
  org: z.string().trim().min(2).max(120),
  role: z.string().trim().min(2).max(120),
  location: z.string().trim().max(120).optional().or(z.literal('')),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().default(null),
  current: z.boolean().default(false),
  summary: z.string().trim().min(10).max(5_000),
  highlights: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
  order: z.coerce.number().int().min(0).max(9999).default(0),
})

/** Sur un PATCH, tous les champs sont optionnels — mais chacun garde sa règle. */
export const experienceUpdateSchema = experienceCreateSchema.partial()

export type ExperienceCreateInput = z.infer<typeof experienceCreateSchema>
export type ExperienceUpdateInput = z.infer<typeof experienceUpdateSchema>
