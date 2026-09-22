import { z } from 'zod'

/**
 * `context` est optionnel dans le schéma Prisma (String?) mais OBLIGATOIRE
 * ici, au niveau de la validation applicative : c'est ce champ qui s'affiche
 * sur le site public et qui nourrit le RAG (« utilisé en production sur
 * ColocBenin et GMP »). Une compétence sans contexte n'a aucune valeur —
 * le sujet interdit explicitement les barres de progression, donc `level`
 * seul ne peut pas porter le sens de cet écran.
 */
export const skillCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  category: z.string().trim().min(2).max(60),
  level: z.coerce.number().int().min(1).max(5).default(3),
  context: z.string().trim().min(10).max(300),
  order: z.coerce.number().int().min(0).max(9999).default(0),
})

/** Sur un PATCH, tous les champs sont optionnels — mais chacun garde sa règle. */
export const skillUpdateSchema = skillCreateSchema.partial()

export type SkillCreateInput = z.infer<typeof skillCreateSchema>
export type SkillUpdateInput = z.infer<typeof skillUpdateSchema>
