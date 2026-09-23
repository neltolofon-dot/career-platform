import { z } from 'zod'

export const bookingSchema = z.object({
  serviceSlug: z.string().min(2).max(80),
  startsAt: z.string().datetime(),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  note: z.string().trim().max(1000).optional().or(z.literal('')),
})
