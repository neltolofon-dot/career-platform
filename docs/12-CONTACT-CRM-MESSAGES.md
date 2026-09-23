# Bloc 5 — Contact, CRM, messagerie et notifications

> **Trois modules du barème d'un coup**, à partir d'un seul formulaire.
> C'est le meilleur rapport points/heure qui reste.

---

## La décision qui structure tout : une écriture, cinq tables

```
Visiteur remplit le formulaire de contact
              │
              ▼
   ┌──── UNE SEULE TRANSACTION ────┐
   │  Contact      (ou retrouvé)   │  ← le pivot
   │  Conversation (ouverte)       │  ← module messagerie
   │  Message      (INBOUND)       │
   │  Lead         (étape NEW)     │  ← module CRM
   │  LeadEvent    (audit)         │
   │  Notification (dashboard)     │
   └───────────────────────────────┘
```

**Pourquoi une transaction et pas six écritures.** Si la création du Lead échoue après
celle de la Conversation, tu as un message sans prospect : le visiteur t'a écrit, et il
n'apparaît nulle part dans ton pipeline. **Soit les six lignes existent, soit aucune.**

**À l'oral :** *« un contact entrant produit six lignes dans cinq tables, en une seule
transaction. Un état partiel n'est pas récupérable automatiquement — c'est exactement ce
pour quoi les transactions existent. »*

---

## Fichier 1 — `lib/validation/contact.ts`

```ts
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
```

---

## Fichier 2 — `lib/services/contact.ts`

```ts
import { prisma } from '@/lib/prisma'
import { parseOrThrow } from './_shared'
import { contactSchema } from '@/lib/validation/contact'
import { bumpEvents } from '@/lib/redis'

/**
 * Traitement d'un contact entrant.
 *
 * Toute la chaîne — personne, conversation, message, prospect, audit,
 * notification — s'exécute dans UNE transaction. Un état partiel
 * (un message sans prospect, un prospect sans conversation) serait
 * invisible et non rattrapable.
 */
export async function submitContact(raw: unknown) {
  const data = parseOrThrow(contactSchema, raw)

  // Piège à robots : on répond comme si tout allait bien, sans écrire.
  // Retourner une erreur apprendrait au robot à contourner le champ.
  if (data.website) {
    return { ok: true as const, spam: true as const }
  }

  await prisma.$transaction(async (tx) => {
    // Le Contact est le PIVOT : identifié par son email, il existe une
    // seule fois quelle que soit la façon dont la personne revient
    // (formulaire, réservation, chatbot).
    const contact = await tx.contact.upsert({
      where: { email: data.email },
      update: {
        name: data.name,
        ...(data.company ? { company: data.company } : {}),
      },
      create: {
        email: data.email,
        name: data.name,
        company: data.company || null,
        firstSource: 'CONTACT_FORM',
      },
    })

    const subject = data.message.slice(0, 60).trim() + (data.message.length > 60 ? '…' : '')

    const conversation = await tx.conversation.create({
      data: {
        contactId: contact.id,
        subject,
        status: 'OPEN',
        // Compteur dénormalisé : la liste admin affiche les non-lus
        // sans lancer un COUNT par ligne. Maintenu ici, dans la même
        // transaction que l'insertion du message.
        unreadCount: 1,
        lastMessageAt: new Date(),
      },
    })

    await tx.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        body: data.message,
      },
    })

    const lead = await tx.lead.create({
      data: {
        contactId: contact.id,
        stage: 'NEW',
        source: 'CONTACT_FORM',
        intent: data.message.slice(0, 500),
      },
    })

    // Journal d'audit immuable : écrit dans la MÊME transaction que
    // le prospect. Un audit qui peut diverger de l'état n'a aucune valeur.
    await tx.leadEvent.create({
      data: {
        leadId: lead.id,
        type: 'LEAD_CREATED',
        toStage: 'NEW',
        payload: { source: 'CONTACT_FORM' },
      },
    })

    await tx.notification.create({
      data: {
        type: 'NEW_LEAD',
        title: `Nouveau contact — ${contact.name}`,
        body: subject,
        entityType: 'conversation',
        entityId: conversation.id,
      },
    })
  })

  // Hors transaction : le compteur Redis n'est pas transactionnel, et
  // un échec de bump ne doit pas annuler un contact réel.
  await bumpEvents().catch(() => {})

  return { ok: true as const, spam: false as const }
}
```

---

## Fichier 3 — `app/api/contact/route.ts`

```ts
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '@/lib/redis'
import { submitContact } from '@/lib/services/contact'
import { ValidationError } from '@/lib/services/_shared'
import { getClientIpHash } from '@/lib/request'

export const runtime = 'nodejs'

const ENV = process.env.VERCEL_ENV ?? 'dev'
const MAX_BODY = 16 * 1024

/**
 * Contrairement au login (Server Action, toujours 200 par protocole RSC),
 * cette route renvoie de VRAIS 429 observables au curl. C'est ici qu'un
 * auditeur peut constater le rate limiting sans outil particulier.
 */
const contactLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: `rl:${ENV}:contact`,
})

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) {
    return Response.json({ error: 'Requête trop volumineuse' }, { status: 413 })
  }

  const ipHash = await getClientIpHash()
  const limit = await contactLimit.limit(ipHash)

  if (!limit.success) {
    return Response.json(
      { error: 'Trop de messages envoyés. Réessayez plus tard.' },
      { status: 429, headers: { 'Retry-After': '3600' } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON invalide' }, { status: 400 })
  }

  try {
    await submitContact(body)
    return Response.json({ ok: true }, { status: 201 })
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: 'Validation', fields: error.fields }, { status: 422 })
    }
    const ref = crypto.randomUUID()
    console.error(JSON.stringify({ level: 'error', scope: 'contact', ref, error: String(error) }))
    return Response.json({ error: 'Une erreur est survenue.', ref }, { status: 500 })
  }
}

const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: 'POST' } })

export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const DELETE = methodNotAllowed
```

---

## Fichier 4 — `components/sections/contact/Contact.tsx`

```tsx
import { SectionFrame } from '@/components/primitives/SectionFrame'
import { ContactForm } from './ContactForm'
import { Mono } from '@/components/primitives/Mono'

/**
 * Mouvement 05 — CONTACT.
 *
 * Deux voies séparées par un filet vertical : écrire, ou réserver un
 * créneau. Pas de carte, pas de boîte — juste deux colonnes et un trait.
 */
export function Contact({
  email,
  availability,
  services,
}: {
  email: string
  availability: string
  services: { slug: string; name: string; durationMin: number }[]
}) {
  return (
    <SectionFrame id="contact" number="05" meta={['Contact', availability]} anchor="5-12" className="enter">
      <h2 className="display display--section">Travaillons ensemble</h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))',
          gap: 'var(--space-12)',
          marginTop: 'var(--space-8)',
        }}
      >
        <div>
          <Mono>Écrire</Mono>
          <hr className="rule" style={{ margin: 'var(--space-3) 0 var(--space-6)' }} />
          <ContactForm />
        </div>

        <div style={{ borderLeft: 'var(--rule-width) solid var(--color-rule)', paddingLeft: 'var(--space-8)' }}>
          <Mono>Réserver un créneau</Mono>
          <hr className="rule" style={{ margin: 'var(--space-3) 0 var(--space-6)' }} />

          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {services.map((s) => (
              <li key={s.slug} style={{ marginBottom: 'var(--space-4)' }}>
                <a href={`/reserver/${s.slug}`} style={{ fontSize: 'var(--text-lg)' }}>
                  {s.name}
                </a>
                <div><Mono>{s.durationMin} minutes</Mono></div>
              </li>
            ))}
          </ul>

          <p className="mono" style={{ marginTop: 'var(--space-8)' }}>
            Ou directement : <a href={`mailto:${email}`}>{email}</a>
          </p>
        </div>
      </div>
    </SectionFrame>
  )
}
```

## Fichier 5 — `components/sections/contact/ContactForm.tsx`

```tsx
'use client'

import { useState, useRef } from 'react'

export function ContactForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('sending')

    const fd = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          email: fd.get('email'),
          company: fd.get('company'),
          message: fd.get('message'),
          website: fd.get('website'), // piège à robots
        }),
      })

      if (res.ok) {
        setState('sent')
        formRef.current?.reset()
        return
      }

      const data = await res.json()
      setError(data.error === 'Validation' ? 'Vérifiez les champs.' : data.error)
      setState('error')
    } catch {
      setError('Connexion impossible.')
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <p className="prose-body" role="status">
        Message reçu. Je vous réponds sous 48 heures.
      </p>
    )
  }

  return (
    <form ref={formRef} onSubmit={onSubmit}>
      <Field name="name" label="Nom" required />
      <Field name="email" label="E-mail" type="email" required />
      <Field name="company" label="Société" />
      <Field name="message" label="Message" textarea required />

      {/* Piège à robots : hors flux visuel, hors ordre de tabulation,
          masqué aux lecteurs d'écran. Un humain ne le remplit jamais. */}
      <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
        <label htmlFor="website">Ne pas remplir</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state === 'error' && (
        <p className="field__error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </p>
      )}

      <button className="btn btn--primary" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Envoi…' : 'Envoyer'}
      </button>
    </form>
  )
}

function Field({
  name,
  label,
  type = 'text',
  textarea = false,
  required = false,
}: {
  name: string
  label: string
  type?: string
  textarea?: boolean
  required?: boolean
}) {
  const id = `contact-${name}`
  return (
    <div className="field" style={{ marginBottom: 'var(--space-6)' }}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {textarea ? (
        <textarea className="field__input" id={id} name={name} rows={6} required={required} maxLength={4000} />
      ) : (
        <input className="field__input" id={id} name={name} type={type} required={required} maxLength={254} />
      )}
    </div>
  )
}
```

---

## Fichier 6 — `lib/services/leads.ts`

```ts
import { prisma } from '@/lib/prisma'
import type { LeadStage } from '@prisma/client'

export const STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'DISCUSSION', 'PROPOSAL', 'WON', 'LOST']

export const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: 'Nouveau',
  CONTACTED: 'Contacté',
  DISCUSSION: 'Discussion',
  PROPOSAL: 'Proposition',
  WON: 'Gagné',
  LOST: 'Perdu',
}

/**
 * Le pipeline entier en UNE requête, groupée côté serveur.
 *
 * L'alternative — six requêtes, une par colonne — coûterait six
 * aller-retours pour afficher un seul écran.
 */
export async function getPipeline() {
  const leads = await prisma.lead.findMany({
    where: { stage: { notIn: [] } },
    select: {
      id: true,
      stage: true,
      intent: true,
      createdAt: true,
      lastActivityAt: true,
      contact: { select: { name: true, email: true, company: true } },
    },
    orderBy: [{ stage: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  })

  const byStage = new Map<LeadStage, typeof leads>()
  for (const s of STAGES) byStage.set(s, [])
  for (const l of leads) byStage.get(l.stage)?.push(l)

  return byStage
}

/**
 * Changement d'étape + écriture du journal d'audit, dans la MÊME
 * transaction. C'est ce qui permet de répondre à « quand ce prospect
 * est-il passé en PROPOSAL, et par quel chemin ».
 */
export async function moveLead(leadId: string, toStage: LeadStage) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
      select: { stage: true },
    })
    if (!lead) throw new Error('Lead introuvable')

    const updated = await tx.lead.update({
      where: { id: leadId },
      data: {
        stage: toStage,
        lastActivityAt: new Date(),
        ...(toStage === 'WON' || toStage === 'LOST' ? { closedAt: new Date() } : { closedAt: null }),
      },
    })

    await tx.leadEvent.create({
      data: {
        leadId,
        type: 'STAGE_CHANGED',
        fromStage: lead.stage,
        toStage,
      },
    })

    return updated
  })
}

export async function getLeadDetail(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      contact: true,
      notes: { orderBy: { createdAt: 'desc' }, take: 50 },
      events: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  })
}
```

---

## Fichier 7 — `app/admin/leads/actions.ts`

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminApi } from '@/lib/auth/guard'
import { moveLead } from '@/lib/services/leads'
import type { LeadStage } from '@prisma/client'

export async function moveLeadAction(formData: FormData) {
  await requireAdminApi()

  const id = String(formData.get('id') ?? '')
  const stage = String(formData.get('stage') ?? '') as LeadStage
  if (!id || !stage) return

  await moveLead(id, stage)
  revalidatePath('/admin/leads')
}

export async function addNoteAction(formData: FormData) {
  const user = await requireAdminApi()

  const leadId = String(formData.get('leadId') ?? '')
  const body = String(formData.get('body') ?? '').trim().slice(0, 2000)
  if (!leadId || body.length < 2) return

  const { prisma } = await import('@/lib/prisma')

  await prisma.$transaction([
    prisma.leadNote.create({ data: { leadId, body, authorId: user.id } }),
    prisma.leadEvent.create({ data: { leadId, type: 'NOTE_ADDED' } }),
    prisma.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } }),
  ])

  revalidatePath('/admin/leads')
}
```

---

## Fichier 8 — `app/admin/leads/page.tsx`

```tsx
import { requireAdminPage } from '@/lib/auth/guard'
import { getPipeline, STAGES, STAGE_LABELS } from '@/lib/services/leads'
import { LeadCard } from '@/components/admin/LeadCard'

export const metadata = { title: 'Leads', robots: { index: false } }

/**
 * Le pipeline CRM — la SEULE vue en colonnes du projet.
 *
 * Pas de glisser-déposer : des boutons de changement d'étape.
 * Décision assumée sous contrainte de temps, documentée dans
 * ARCHITECTURE.md. Le glisser-déposer aurait coûté une bibliothèque
 * cliente et une heure, pour zéro point de barème — l'exigence est
 * un pipeline fonctionnel, pas une interaction particulière.
 */
export default async function LeadsPage() {
  await requireAdminPage()
  const pipeline = await getPipeline()

  const total = [...pipeline.values()].reduce((n, l) => n + l.length, 0)

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">Pipeline</h1>
      <p className="mono" style={{ marginTop: 'var(--space-2)' }}>
        {total} prospects
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${STAGES.length}, minmax(13rem, 1fr))`,
          gap: 0,
          marginTop: 'var(--space-8)',
          overflowX: 'auto',
        }}
      >
        {STAGES.map((stage, i) => {
          const leads = pipeline.get(stage) ?? []
          return (
            <section
              key={stage}
              style={{
                borderLeft: i === 0 ? 'none' : 'var(--rule-width) solid var(--color-rule)',
                padding: '0 var(--space-3)',
                minWidth: 0,
              }}
            >
              <header
                style={{
                  paddingBottom: 'var(--space-2)',
                  borderBottom: 'var(--rule-width) solid var(--color-ink)',
                }}
              >
                <span className="mono">
                  {STAGE_LABELS[stage]} · {leads.length}
                </span>
              </header>

              {leads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} currentStage={stage} />
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}
```

## Fichier 9 — `components/admin/LeadCard.tsx`

```tsx
import { STAGES, STAGE_LABELS } from '@/lib/services/leads'
import { moveLeadAction } from '@/app/admin/leads/actions'
import type { LeadStage } from '@prisma/client'

type Lead = {
  id: string
  intent: string
  createdAt: Date
  contact: { name: string; email: string; company: string | null }
}

/** Âge du prospect, en clair : un prospect qui dort se voit. */
function ageLabel(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  return `il y a ${days} j`
}

export function LeadCard({ lead, currentStage }: { lead: Lead; currentStage: LeadStage }) {
  const next = STAGES.filter((s) => s !== currentStage)

  return (
    <article
      style={{
        paddingBlock: 'var(--space-3)',
        borderBottom: 'var(--rule-width) solid var(--color-rule)',
      }}
    >
      <strong style={{ fontSize: 'var(--text-sm)' }}>{lead.contact.name}</strong>
      <div className="mono">{lead.contact.company || lead.contact.email}</div>

      <p
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-ink-muted)',
          marginBlock: 'var(--space-2)',
        }}
      >
        {lead.intent.slice(0, 90)}
        {lead.intent.length > 90 && '…'}
      </p>

      <div className="mono">{ageLabel(lead.createdAt)}</div>

      <form action={moveLeadAction} style={{ marginTop: 'var(--space-2)' }}>
        <input type="hidden" name="id" value={lead.id} />
        <select
          name="stage"
          className="mono"
          defaultValue=""
          style={{ background: 'transparent', border: 0, cursor: 'pointer', width: '100%' }}
        >
          <option value="" disabled>
            Déplacer vers…
          </option>
          {next.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="mono" style={{ background: 'none', border: 0, cursor: 'pointer' }}>
          OK
        </button>
      </form>
    </article>
  )
}
```

---

## Fichier 10 — `app/admin/messages/page.tsx`

```tsx
import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { paginationSchema, toSkipTake } from '@/lib/pagination'

export const metadata = { title: 'Messages', robots: { index: false } }

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdminPage()

  const sp = await searchParams
  const pagination = paginationSchema.parse({ page: sp.page, perPage: 20 })

  const [conversations, total] = await prisma.$transaction([
    prisma.conversation.findMany({
      select: {
        id: true,
        subject: true,
        status: true,
        unreadCount: true,
        lastMessageAt: true,
        contact: { select: { name: true, email: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
      ...toSkipTake(pagination),
    }),
    prisma.conversation.count(),
  ])

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">Messages</h1>
      <p className="mono" style={{ marginTop: 'var(--space-2)' }}>
        {total} conversations
      </p>

      <table className="admin-table" style={{ marginTop: 'var(--space-6)' }}>
        <thead>
          <tr>
            <th scope="col">De</th>
            <th scope="col">Sujet</th>
            <th scope="col">Statut</th>
            <th scope="col">Dernier message</th>
          </tr>
        </thead>
        <tbody>
          {conversations.map((c) => (
            <tr key={c.id}>
              <td>
                <Link href={`/admin/messages/${c.id}`}>{c.contact.name}</Link>
                <div className="mono">{c.contact.email}</div>
              </td>
              <td>
                {c.subject}
                {c.unreadCount > 0 && (
                  <span className="badge badge--urgent" style={{ marginLeft: 8 }}>
                    {c.unreadCount} non lu
                  </span>
                )}
              </td>
              <td>
                <span className={`badge ${c.status === 'OPEN' ? 'badge--urgent' : 'badge--draft'}`}>
                  {c.status === 'OPEN' ? 'Ouverte' : c.status === 'ANSWERED' ? 'Répondue' : 'Close'}
                </span>
              </td>
              <td className="mono mono--data">{c.lastMessageAt.toLocaleString('fr-FR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

## Fichier 11 — `app/admin/messages/[id]/page.tsx`

```tsx
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { replyAction } from '../actions'

export const metadata = { title: 'Conversation', robots: { index: false } }

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage()
  const { id } = await params

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!conversation) notFound()

  // Ouvrir la conversation la marque comme lue. Dans le même passage,
  // on solde les notifications qui la concernaient.
  if (conversation.unreadCount > 0) {
    await prisma.$transaction([
      prisma.conversation.update({ where: { id }, data: { unreadCount: 0 } }),
      prisma.message.updateMany({
        where: { conversationId: id, readAt: null, direction: 'INBOUND' },
        data: { readAt: new Date() },
      }),
      prisma.notification.updateMany({
        where: { entityType: 'conversation', entityId: id, readAt: null },
        data: { readAt: new Date() },
      }),
    ])
  }

  const reply = replyAction.bind(null, id)

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: '48rem' }}>
      <h1 className="display display--section">{conversation.subject}</h1>
      <p className="mono" style={{ marginTop: 'var(--space-2)' }}>
        {conversation.contact.name} · {conversation.contact.email}
        {conversation.contact.company && ` · ${conversation.contact.company}`}
      </p>

      <div style={{ marginTop: 'var(--space-8)' }}>
        {conversation.messages.map((m) => (
          <div
            key={m.id}
            style={{
              paddingBlock: 'var(--space-4)',
              borderTop: 'var(--rule-width) solid var(--color-rule)',
              paddingLeft: m.direction === 'OUTBOUND' ? 'var(--space-8)' : 0,
            }}
          >
            <span className="mono">
              {m.direction === 'INBOUND' ? conversation.contact.name : 'Vous'} ·{' '}
              {m.createdAt.toLocaleString('fr-FR')}
            </span>
            {/* Contenu utilisateur rendu comme TEXTE par React :
                échappement automatique, aucun HTML interprété. */}
            <p className="prose-body" style={{ marginTop: 'var(--space-2)', whiteSpace: 'pre-wrap' }}>
              {m.body}
            </p>
          </div>
        ))}
      </div>

      <form action={reply} style={{ marginTop: 'var(--space-8)' }}>
        <div className="field">
          <label className="field__label" htmlFor="reply">
            Répondre
          </label>
          <textarea className="field__input" id="reply" name="body" rows={6} required maxLength={4000} />
        </div>
        <button className="btn btn--primary" type="submit" style={{ marginTop: 'var(--space-4)' }}>
          Envoyer
        </button>
      </form>
    </div>
  )
}
```

## Fichier 12 — `app/admin/messages/actions.ts`

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminApi } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

/**
 * La réponse est enregistrée en base et visible dans le fil.
 *
 * DETTE ASSUMÉE : aucun e-mail n'est envoyé au visiteur — pas de
 * service d'envoi dans le temps imparti. Documenté dans
 * ARCHITECTURE.md comme limitation connue, pas comme oubli.
 */
export async function replyAction(conversationId: string, formData: FormData) {
  await requireAdminApi()

  const body = String(formData.get('body') ?? '').trim().slice(0, 4000)
  if (body.length < 2) return

  await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, direction: 'OUTBOUND', body },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'ANSWERED', lastMessageAt: new Date() },
    }),
  ])

  revalidatePath(`/admin/messages/${conversationId}`)
  revalidatePath('/admin/messages')
}
```

---

## Fichier 13 — `app/api/admin/notifications/route.ts`

```ts
import { withAdmin } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { getEventsVersion } from '@/lib/redis'

export const runtime = 'nodejs'

/**
 * Notifications non lues + version d'événements.
 *
 * Le client interroge cette route toutes les 10 s. La version Redis
 * permet au client de savoir qu'il n'y a RIEN de neuf sans relire
 * la liste : une lecture Redis O(1) plutôt qu'une requête Postgres.
 *
 * DETTE ASSUMÉE : SSE prévu à l'origine (décision D4), remplacé par
 * ce polling sous contrainte de temps. Latence perçue ~10 s au lieu
 * de ~2 s. Documenté dans ARCHITECTURE.md ; l'interface client est
 * conçue pour pouvoir basculer sur SSE sans la modifier.
 */
export async function GET() {
  return withAdmin(async () => {
    const [version, notifications, unreadMessages] = await Promise.all([
      getEventsVersion(),
      prisma.notification.findMany({
        where: { readAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, type: true, title: true, body: true, entityType: true, entityId: true, createdAt: true },
      }),
      prisma.conversation.aggregate({ _sum: { unreadCount: true } }),
    ])

    return Response.json({
      version,
      notifications,
      unreadMessages: unreadMessages._sum.unreadCount ?? 0,
    })
  })
}

export const POST = () => new Response(null, { status: 405, headers: { Allow: 'GET' } })
```

## Fichier 14 — `components/admin/NotificationBell.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Notification = {
  id: string
  title: string
  body: string
  entityType: string
  entityId: string
}

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    let lastVersion = -1

    async function poll() {
      try {
        const res = await fetch('/api/admin/notifications')
        if (!res.ok) return
        const data = await res.json()

        // La version Redis évite de réécrire l'état quand rien n'a bougé :
        // pas de re-rendu inutile toutes les 10 secondes.
        if (alive && data.version !== lastVersion) {
          lastVersion = data.version
          setItems(data.notifications)
        }
      } catch {
        // silencieux : une notification manquée n'est pas critique
      }
    }

    poll()
    const id = setInterval(poll, 10_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  return (
    <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
      <button
        type="button"
        className="mono"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          background: 'none',
          border: 0,
          cursor: 'pointer',
          color: items.length ? 'var(--color-vermilion)' : 'var(--color-ink-muted)',
        }}
      >
        Notifications {items.length > 0 && `· ${items.length}`}
      </button>

      {open && items.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-2) 0 0' }}>
          {items.map((n) => (
            <li
              key={n.id}
              style={{
                paddingBlock: 'var(--space-2)',
                borderTop: 'var(--rule-width) solid var(--color-rule)',
              }}
            >
              <Link
                href={n.entityType === 'conversation' ? `/admin/messages/${n.entityId}` : '/admin/leads'}
                style={{ fontSize: 'var(--text-xs)' }}
              >
                {n.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

---

## Tests à passer

```bash
URL="https://career-platform-pied.vercel.app"

# 1. Contact valide → 201
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL/api/contact" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Jury","email":"jury@test.fr","message":"Bonjour, je souhaite discuter d un projet de plateforme web."}'

# 2. Validation → 422
curl -s -X POST "$URL/api/contact" -H "Content-Type: application/json" \
  -d '{"name":"x","email":"pasunemail","message":"court"}'

# 3. Rate limit → 429 après 3
for i in 1 2 3 4 5; do curl -s -o /dev/null -w "%{http_code} " -X POST "$URL/api/contact" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"T$i\",\"email\":\"t$i@test.fr\",\"message\":\"Message de test numero $i pour le rate limit.\"}"; done; echo

# 4. Méthode interdite → 405
curl -s -o /dev/null -w "%{http_code}\n" "$URL/api/contact"

# 5. Piège à robots → 201 mais AUCUNE écriture en base
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL/api/contact" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bot","email":"bot@spam.ru","message":"Message automatique de spam commercial.","website":"http://spam.ru"}'
```

---

## Prompt pour Codex

```
Lis AGENTS.md et docs/12-CONTACT-CRM-MESSAGES.md.

URGENT — rendu à 20h. Exécute, ne propose rien.

1. Crée les 14 fichiers exactement comme spécifiés.

2. Ajoute la section Contact à app/(public)/page.tsx, après Dialogue.
   Elle a besoin des services : ajoute getPublicServices() à
   lib/services/public.ts (cached, where active: true, order asc).

3. Ajoute <NotificationBell /> dans app/admin/layout.tsx, au-dessus du
   formulaire de déconnexion.

4. tsc --noEmit, npm run build, git push.

5. Rejoue les 5 tests contre la production, sortie brute.

6. Test d'intégrité de la transaction : après le test 1, vérifie en base
   qu'on a bien 1 Contact + 1 Conversation + 1 Message + 1 Lead +
   1 LeadEvent + 1 Notification, tous liés. Montre-moi les décomptes.

7. Vérifie que le test 5 (piège à robots) n'a créé AUCUNE ligne.

8. Ouvre /admin/leads et /admin/messages, confirme que le lead et la
   conversation du test 1 apparaissent.

Si un test échoue, arrête-toi.
```
