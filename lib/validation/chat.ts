import { z } from 'zod'

/**
 * max(500) n'est pas cosmétique : la question part dans un appel
 * d'embedding PAYANT, puis dans un appel de génération PAYANT.
 * Sans plafond, une question de 100 Ko coûte de l'argent réel à
 * chaque requête. Le plafond est une protection financière autant
 * que technique.
 */
export const chatSchema = z.object({
  question: z.string().trim().min(3).max(500),
  sessionId: z.string().cuid().optional(),
})
