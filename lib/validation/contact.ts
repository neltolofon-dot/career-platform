import { z } from 'zod'

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  company: z.string().trim().max(120).optional().or(z.literal('')),
  message: z.string().trim().min(20).max(4000),
  // Champ piège : invisible pour un humain, rempli par les robots.
  // Anti-spam à coût nul, sans CAPTCHA ni service tiers.
  // Accepte toute valeur : c'est submitContact() qui la détecte et répond
  // 201 sans écrire. Un .max(0) ici renverrait un 422 nommant `website` —
  // soit exactement l'indice qui apprend au robot où est le piège.
  website: z.string().optional(),
})

export type ContactInput = z.infer<typeof contactSchema>
