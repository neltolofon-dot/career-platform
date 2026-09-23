import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { chatSchema } from '@/lib/validation/chat'
import { answerQuestion } from '@/lib/rag/answer'
import { getClientIpHash } from '@/lib/request'

export const runtime = 'nodejs'
// 60, pas 30 : gemini-3.5-flash-lite mesuré à 25-30+ s à lui seul en
// production (voir PERFORMANCE.md § Latence Gemini), avant même
// l'embedding et les requêtes DB. 30 s faisait timeout la route.
export const maxDuration = 60

const ENV = process.env.VERCEL_ENV ?? 'dev'

/**
 * Double fenêtre, comme sur le login :
 * - par visiteur : évite qu'une personne épuise le quota Gemini
 * - par IP : borne une attaque distribuée sur un même réseau
 *
 * Contrairement à la Server Action du login, c'est un route handler :
 * il renvoie de VRAIS 429 observables au curl. Un auditeur peut le tester.
 */
const chatLimitByVisitor = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: `rl:${ENV}:chat:visitor`,
})

const chatLimitByIp = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 h'),
  prefix: `rl:${ENV}:chat:ip`,
})

const MAX_BODY = 8 * 1024

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) {
    return Response.json({ error: 'Requête trop volumineuse' }, { status: 413 })
  }

  const ipHash = await getClientIpHash()

  const [visitorLimit, ipLimit] = await Promise.all([
    chatLimitByVisitor.limit(ipHash),
    chatLimitByIp.limit(ipHash),
  ])

  if (!visitorLimit.success || !ipLimit.success) {
    return Response.json(
      { error: 'Trop de questions. Réessayez dans une heure.' },
      { status: 429, headers: { 'Retry-After': '3600' } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const parsed = chatSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Question invalide' }, { status: 422 })
  }

  const { question } = parsed.data
  const started = Date.now()

  try {
    const answer = await answerQuestion(question)

    // Traçabilité : chaque échange est persisté avec ses citations et son
    // statut de refus. On peut auditer a posteriori pourquoi le chatbot
    // a répondu ce qu'il a répondu.
    const session = parsed.data.sessionId
      ? await prisma.chatSession.findUnique({ where: { id: parsed.data.sessionId } })
      : null

    const chatSession =
      session ?? (await prisma.chatSession.create({ data: { visitorKey: ipHash } }))

    await prisma.chatMessage.createMany({
      data: [
        { chatSessionId: chatSession.id, role: 'USER', content: question },
        {
          chatSessionId: chatSession.id,
          role: 'ASSISTANT',
          content: answer.text,
          citations: answer.citations,
          refused: answer.refused,
          latencyMs: Date.now() - started,
        },
      ],
    })

    return Response.json({
      answer: answer.text,
      citations: answer.citations,
      refused: answer.refused,
      sessionId: chatSession.id,
    })
  } catch (error) {
    const ref = crypto.randomUUID()
    console.error(JSON.stringify({ level: 'error', scope: 'chat', ref, error: String(error) }))
    return Response.json(
      { error: 'Une erreur est survenue.', ref },
      { status: 500 },
    )
  }
}

const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: 'POST' } })

export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const DELETE = methodNotAllowed
