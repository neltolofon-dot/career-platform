import { z } from 'zod'

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  company: z.string().trim().max(120).optional().or(z.literal('')),
  message: z.string().trim().min(20).max(4000),
  // Champ piège : invisible pour un humain, rempli par les robots.
  // Anti-spam à coût nul, sans CAPTCHA ni service tiers.
  website: z.string().max(0).optional(),
})

export type ContactInput = z.infer<typeof contactSchema>
