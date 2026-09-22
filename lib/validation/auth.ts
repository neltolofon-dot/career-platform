import { z } from 'zod'

/**
 * La validation est SERVEUR. Une validation côté client est du confort
 * d'interface, jamais une garantie : le client est sous le contrôle
 * de l'attaquant.
 *
 * Les longueurs maximales ne sont pas cosmétiques : sans elles, un
 * attaquant envoie un mot de passe de 10 Mo et te fait brûler du CPU
 * Argon2id. C'est un déni de service à un euro.
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
})

export type LoginInput = z.infer<typeof loginSchema>
