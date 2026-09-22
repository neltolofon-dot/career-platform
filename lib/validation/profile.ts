import { z } from 'zod'

/**
 * Pas de schéma de création : Profile est un singleton (id figé à "profile"),
 * créé une seule fois par le seed. Le formulaire admin ne fait jamais que
 * mettre à jour la ligne existante — d'où un seul schéma, utilisé par PATCH.
 */
export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  headline: z.string().trim().min(2).max(200),
  bio: z.string().trim().min(10).max(5_000),
  location: z.string().trim().min(2).max(120),
  timezone: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email().max(254),
  availability: z.string().trim().min(2).max(200),
  openToWork: z.boolean().default(true),
  socials: z
    .object({
      github: z.string().url().max(300).optional().or(z.literal('')),
      linkedin: z.string().url().max(300).optional().or(z.literal('')),
      x: z.string().url().max(300).optional().or(z.literal('')),
      facebook: z.string().url().max(300).optional().or(z.literal('')),
    })
    .default({}),
  resumeUrl: z.string().url().max(300).optional().or(z.literal('')),
})

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
