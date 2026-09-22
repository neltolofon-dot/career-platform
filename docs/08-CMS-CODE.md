# Bloc 2 — Primitives UI, couche service et CMS admin

> Le CRUD projets écrit ici est le **patron** des quatre autres (experiences, skills,
> articles, media). Une fois validé, on le réplique.

---

## Les trois décisions de ce bloc

### D11 — Une couche de service, deux transports

```
        Server Action                 Route handler
     (formulaires admin)          (API testable au curl)
              │                            │
              └────────────┬───────────────┘
                           ▼
                  lib/services/projects.ts
                  ┌──────────────────────┐
                  │ validation Zod       │
                  │ transaction Prisma   │
                  │ bump du cache Redis  │
                  │ réindexation RAG     │
                  └──────────────────────┘
```

**Pourquoi.** Le sujet évalue l'API *et* l'espace admin. Écrire la logique deux fois
garantit qu'elles divergeront : on corrige un bug d'un côté, pas de l'autre. Ici la
validation, la transaction, l'invalidation de cache et la réindexation existent **une
seule fois**. Les deux transports ne font que traduire une entrée et formater une sortie.

**À l'oral :** *« mon API et mon admin ne peuvent pas diverger, parce qu'ils appellent
la même fonction. Un transport ne contient aucune règle métier. »*

### D12 — La pagination est obligatoire et validée

Toute liste exposée est paginée côté serveur, avec `page` et `perPage` **validés par Zod**
et plafonnés. Sans plafond, `?perPage=999999` est un déni de service à une requête : on
charge toute la table en mémoire.

### D13 — Le cache s'invalide par version, jamais par clé

Une écriture incrémente `{ENV}:portfolio:version`. Toutes les clés de l'ancienne version
deviennent inatteignables d'un coup. Pas de `SCAN`, pas de `DEL` en masse, et surtout
**aucun risque d'oublier une clé** quand on ajoutera une page dans trois heures.

---

## Fichier 1 — `components/primitives/SectionFrame.tsx` ⭐

La pièce maîtresse de la direction artistique. Écrite une fois, réutilisée par les six
sections publiques et par l'admin.

```tsx
import type { ReactNode } from 'react'

/**
 * La grille signature : colonne de métadonnées en marge + contenu ancré
 * asymétriquement dans une grille de 12 colonnes.
 *
 * Pourquoi un composant et pas des classes ad hoc par section : c'est ce
 * qui garantit que six sections écrites à six moments différents partagent
 * exactement la même structure. Sans lui, chaque section réinvente sa mise
 * en page et l'identité visuelle se dissout.
 *
 * Les valeurs d'ancrage sont volontairement arbitraires et différentes
 * d'une section à l'autre : une composition doit donner l'impression
 * d'avoir été décidée, pas d'être un conteneur centré répété six fois.
 */

export type Anchor = '1-11' | '1-12' | '3-10' | '4-12' | '2-9' | '5-12'

type SectionFrameProps = {
  /** Numéro à deux chiffres affiché en marge : "00", "01"… */
  number: string
  /** Métadonnées secondaires en marge (années, décomptes, statut) */
  meta?: string[]
  anchor: Anchor
  children: ReactNode
  /** id d'ancrage pour la navigation */
  id?: string
  className?: string
}

export function SectionFrame({
  number,
  meta = [],
  anchor,
  children,
  id,
  className = '',
}: SectionFrameProps) {
  return (
    <section
      id={id}
      data-anchor={anchor}
      className={`section ${className}`.trim()}
    >
      <div className="section__meta">
        <span className="mono" aria-hidden="true">
          {number}
        </span>
        {meta.map((line) => (
          <span className="mono" key={line}>
            {line}
          </span>
        ))}
      </div>

      <div className="section__body">{children}</div>
    </section>
  )
}
```

## Fichier 2 — `components/primitives/Rule.tsx`

```tsx
/**
 * Le filet 1px est le SEUL séparateur autorisé du design system.
 * Composant plutôt que classe brute pour rendre l'interdiction visible :
 * si quelqu'un écrit une box-shadow, ça se voit à la revue.
 */
export function Rule({ vertical = false }: { vertical?: boolean }) {
  return <hr className={vertical ? 'rule--v' : 'rule'} aria-hidden="true" />
}
```

## Fichier 3 — `components/primitives/Mono.tsx`

```tsx
import type { ReactNode } from 'react'

/**
 * Tout chiffre, date, label ou identifiant passe par ici.
 * Source de vérité typographique unique : si la police mono change,
 * un seul fichier bouge.
 */
export function Mono({
  children,
  data = false,
  as: Tag = 'span',
}: {
  children: ReactNode
  /** true = donnée lisible (13px, casse conservée) ; false = label (11px, majuscules) */
  data?: boolean
  as?: 'span' | 'div' | 'p' | 'dd' | 'dt'
}) {
  return <Tag className={data ? 'mono mono--data' : 'mono'}>{children}</Tag>
}
```

---

## Fichier 4 — `lib/pagination.ts`

```ts
import { z } from 'zod'

/**
 * Le plafond sur perPage n'est pas du confort : sans lui, ?perPage=999999
 * charge toute la table en mémoire serveur. C'est un déni de service à
 * une seule requête, et le sujet l'exige explicitement.
 *
 * coerce.number() parce qu'un query param est toujours une chaîne.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

export type Pagination = z.infer<typeof paginationSchema>

export type Paginated<T> = {
  items: T[]
  page: number
  perPage: number
  total: number
  totalPages: number
}

export function toSkipTake({ page, perPage }: Pagination) {
  return { skip: (page - 1) * perPage, take: perPage }
}

export function paginate<T>(
  items: T[],
  total: number,
  { page, perPage }: Pagination,
): Paginated<T> {
  return {
    items,
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}
```

---

## Fichier 5 — `lib/validation/project.ts`

```ts
import { z } from 'zod'

/**
 * Le slug est validé par une regex stricte : il finit dans une URL et dans
 * une clé de cache. Un slug libre ouvrirait la porte à des collisions de
 * clés Redis et à des URLs imprévisibles.
 */
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide : minuscules, chiffres et tirets')

/**
 * Toutes les longueurs sont plafonnées. Un champ texte sans max, c'est
 * une requête de 10 Mo qui sature la base et le cache.
 */
export const projectCreateSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(10).max(400),
  content: z.string().trim().max(20_000).default(''),
  role: z.string().trim().min(2).max(120),
  domain: z.string().trim().min(2).max(60),
  year: z.coerce.number().int().min(2000).max(2100),
  stack: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  outcomes: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  links: z
    .object({
      live: z.string().url().max(300).optional().or(z.literal('')),
      repo: z.string().url().max(300).optional().or(z.literal('')),
    })
    .default({}),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  featured: z.boolean().default(false),
  order: z.coerce.number().int().min(0).max(9999).default(0),
  coverId: z.string().cuid().nullable().default(null),
})

/** Sur un PATCH, tous les champs sont optionnels — mais chacun garde sa règle. */
export const projectUpdateSchema = projectCreateSchema.partial()

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>
```

---

## Fichier 6 — `lib/services/projects.ts` ⭐ le cœur

```ts
import { Prisma, type ContentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { bumpCacheVersion, cached } from '@/lib/redis'
import {
  projectCreateSchema,
  projectUpdateSchema,
  type ProjectCreateInput,
  type ProjectUpdateInput,
} from '@/lib/validation/project'
import {
  paginate,
  toSkipTake,
  type Pagination,
  type Paginated,
} from '@/lib/pagination'
import { onContentChanged } from '@/lib/rag/hooks'

/**
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  COUCHE SERVICE — la logique métier vit ICI, une seule fois.         │
 * │                                                                      │
 * │  Les Server Actions (formulaires admin) et les route handlers        │
 * │  (/api/admin/projects) appellent ces fonctions. Ce sont deux         │
 * │  TRANSPORTS, ils ne contiennent aucune règle.                        │
 * │                                                                      │
 * │  Conséquence : mon API et mon admin ne peuvent pas diverger.         │
 * └──────────────────────────────────────────────────────────────────────┘
 */

// ─── ERREURS MÉTIER TYPÉES ───────────────────────────────────────────────────

/**
 * Erreurs typées plutôt que des chaînes : chaque transport décide comment
 * les rendre (JSON + statut pour l'API, état de formulaire pour l'admin),
 * sans jamais exposer un message Prisma brut au client.
 */
export class ValidationError extends Error {
  constructor(public readonly fields: Record<string, string[]>) {
    super('Validation failed')
    this.name = 'ValidationError'
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class NotFoundError extends Error {
  constructor() {
    super('Not found')
    this.name = 'NotFoundError'
  }
}

// ─── SÉLECTIONS ──────────────────────────────────────────────────────────────

/**
 * Sélection explicite plutôt que le modèle entier.
 * Deux raisons : on ne transfère que ce qu'on affiche (performance), et on
 * ne peut pas exposer par accident un champ ajouté plus tard au schéma.
 */
const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  domain: true,
  role: true,
  year: true,
  stack: true,
  status: true,
  featured: true,
  order: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect

const PUBLIC_SELECT = {
  ...LIST_SELECT,
  summary: true,
  links: true,
  cover: { select: { url: true, alt: true, width: true, height: true, blurDataUrl: true } },
} satisfies Prisma.ProjectSelect

// ─── LECTURES ────────────────────────────────────────────────────────────────

/** Liste admin : tous statuts confondus, paginée. */
export async function listProjectsForAdmin(
  pagination: Pagination,
  filters: { status?: ContentStatus; q?: string } = {},
): Promise<Paginated<Prisma.ProjectGetPayload<{ select: typeof LIST_SELECT }>>> {
  const where: Prisma.ProjectWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? {
          OR: [
            { title: { contains: filters.q, mode: 'insensitive' } },
            { domain: { contains: filters.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  // Transaction : le count et la page proviennent du même instantané.
  // Sans ça, une écriture concurrente fait afficher "21 résultats" sur
  // une page qui en contient 20 issus d'un état antérieur.
  const [items, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      select: LIST_SELECT,
      orderBy: [{ featured: 'desc' }, { order: 'asc' }, { year: 'desc' }],
      ...toSkipTake(pagination),
    }),
    prisma.project.count({ where }),
  ])

  return paginate(items, total, pagination)
}

/**
 * Liste publique : uniquement PUBLISHED, mise en cache.
 *
 * L'index composite @@index([status, featured, order]) couvre exactement
 * ce WHERE + ORDER BY — vérifiable par EXPLAIN ANALYZE.
 */
export async function listPublishedProjects() {
  return cached('projects:published', 300, async () =>
    prisma.project.findMany({
      where: { status: 'PUBLISHED' },
      select: PUBLIC_SELECT,
      orderBy: [{ featured: 'desc' }, { order: 'asc' }, { year: 'desc' }],
    }),
  )
}

export async function getProjectBySlug(slug: string) {
  return cached(`project:${slug}`, 300, async () =>
    prisma.project.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: { ...PUBLIC_SELECT, content: true, outcomes: true },
    }),
  )
}

export async function getProjectForAdmin(id: string) {
  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) throw new NotFoundError()
  return project
}

// ─── ÉCRITURES ───────────────────────────────────────────────────────────────

export async function createProject(raw: unknown) {
  const parsed = projectCreateSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  try {
    const project = await prisma.project.create({
      data: {
        ...data,
        links: data.links as Prisma.InputJsonValue,
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
      },
    })

    await afterWrite(project.id)
    return project
  } catch (error) {
    throw translatePrismaError(error)
  }
}

export async function updateProject(id: string, raw: unknown) {
  const parsed = projectUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  try {
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...data,
        ...(data.links ? { links: data.links as Prisma.InputJsonValue } : {}),
        // Première publication : on horodate. Une republication ne réécrit pas la date.
        ...(data.status === 'PUBLISHED' ? { publishedAt: { set: new Date() } } : {}),
      },
    })

    await afterWrite(project.id)
    return project
  } catch (error) {
    throw translatePrismaError(error)
  }
}

export async function deleteProject(id: string) {
  try {
    await prisma.project.delete({ where: { id } })
    await afterWrite(id, { removed: true })
  } catch (error) {
    throw translatePrismaError(error)
  }
}

// ─── EFFETS DE BORD ──────────────────────────────────────────────────────────

/**
 * Deux effets après CHAQUE écriture, centralisés ici pour qu'aucun
 * transport ne puisse les oublier :
 *
 * 1. Invalidation du cache par version — un INCR rend inatteignables
 *    toutes les clés de l'ancienne version, sans SCAN ni DEL en masse.
 * 2. Réindexation RAG — la base de connaissances du chatbot suit le CMS.
 *    Si on l'oublie, le chatbot répond sur des données mortes.
 */
async function afterWrite(projectId: string, opts: { removed?: boolean } = {}) {
  await bumpCacheVersion()
  await onContentChanged({
    sourceType: 'PROJECT',
    sourceId: projectId,
    removed: opts.removed ?? false,
  })
}

/**
 * Traduit les codes Prisma en erreurs métier.
 *
 * C'est ce qui empêche un message Prisma d'atteindre le client : un
 * « Unique constraint failed on the fields: (`slug`) » révèle le nom de
 * mes colonnes et la structure de ma base.
 */
function translatePrismaError(error: unknown): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return new ConflictError('Ce slug est déjà utilisé.')
    if (error.code === 'P2025') return new NotFoundError()
  }
  return error instanceof Error ? error : new Error('Unknown error')
}
```

---

## Fichier 7 — `lib/rag/hooks.ts` (contrat, implémenté au bloc 3)

```ts
import type { KnowledgeSourceType } from '@prisma/client'

/**
 * Point d'accroche de la réindexation RAG.
 *
 * Volontairement défini MAINTENANT, avant le pipeline RAG : les écritures
 * CMS l'appellent déjà, donc quand le bloc 3 l'implémentera, toute la
 * réindexation fonctionnera sans toucher une ligne de la couche service.
 *
 * Il avale ses erreurs : un échec d'embedding ne doit jamais faire échouer
 * la sauvegarde d'un projet. La cohérence de la base de connaissances est
 * rattrapable par un bouton « réindexer » dans l'admin ; la perte du
 * travail de l'utilisateur ne l'est pas.
 */
export type ContentChange = {
  sourceType: KnowledgeSourceType
  sourceId: string
  removed: boolean
}

export async function onContentChanged(change: ContentChange): Promise<void> {
  try {
    // Bloc 3 : chunking → embedding → upsert dans knowledge_chunks
    void change
  } catch (error) {
    console.error(
      JSON.stringify({ level: 'error', scope: 'rag.reindex', error: String(error) }),
    )
  }
}
```

---

## Fichier 8 — `app/api/admin/projects/route.ts`

```ts
import { withAdmin } from '@/lib/auth/guard'
import { paginationSchema } from '@/lib/pagination'
import {
  listProjectsForAdmin,
  createProject,
  ValidationError,
  ConflictError,
} from '@/lib/services/projects'

// Prisma nécessite le runtime Node, pas Edge.
export const runtime = 'nodejs'

/** Limite de taille du corps : 256 Ko. Au-delà, on refuse sans lire. */
const MAX_BODY_BYTES = 256 * 1024

export async function GET(request: Request) {
  return withAdmin(async () => {
    const url = new URL(request.url)

    const parsed = paginationSchema.safeParse({
      page: url.searchParams.get('page') ?? undefined,
      perPage: url.searchParams.get('perPage') ?? undefined,
    })

    if (!parsed.success) {
      return Response.json({ error: 'Paramètres de pagination invalides' }, { status: 400 })
    }

    const status = url.searchParams.get('status') ?? undefined
    const q = url.searchParams.get('q')?.slice(0, 100) ?? undefined

    const result = await listProjectsForAdmin(parsed.data, {
      status: status as never,
      q,
    })

    return Response.json(result)
  })
}

export async function POST(request: Request) {
  return withAdmin(async () => {
    // Contrôle de taille AVANT de lire le corps
    const length = Number(request.headers.get('content-length') ?? 0)
    if (length > MAX_BODY_BYTES) {
      return Response.json({ error: 'Payload trop volumineux' }, { status: 413 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'JSON invalide' }, { status: 400 })
    }

    try {
      const project = await createProject(body)
      return Response.json(project, { status: 201 })
    } catch (error) {
      if (error instanceof ValidationError) {
        return Response.json({ error: 'Validation', fields: error.fields }, { status: 422 })
      }
      if (error instanceof ConflictError) {
        return Response.json({ error: error.message }, { status: 409 })
      }
      throw error // withAdmin journalise et renvoie un 500 générique
    }
  })
}

/**
 * Méthodes non autorisées → 405 explicite avec l'en-tête Allow,
 * plutôt que le comportement par défaut du framework.
 * Exigé par le sujet : « méthodes HTTP explicitement autorisées ».
 */
const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: 'GET, POST' } })

export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
```

## Fichier 9 — `app/api/admin/projects/[id]/route.ts`

```ts
import { withAdmin } from '@/lib/auth/guard'
import {
  getProjectForAdmin,
  updateProject,
  deleteProject,
  ValidationError,
  ConflictError,
  NotFoundError,
} from '@/lib/services/projects'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 256 * 1024

// Next.js 15+ : params est une Promise.
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Ctx) {
  return withAdmin(async () => {
    const { id } = await params
    try {
      return Response.json(await getProjectForAdmin(id))
    } catch (error) {
      if (error instanceof NotFoundError) {
        return Response.json({ error: 'Introuvable' }, { status: 404 })
      }
      throw error
    }
  })
}

export async function PATCH(request: Request, { params }: Ctx) {
  return withAdmin(async () => {
    const { id } = await params

    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
      return Response.json({ error: 'Payload trop volumineux' }, { status: 413 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'JSON invalide' }, { status: 400 })
    }

    try {
      return Response.json(await updateProject(id, body))
    } catch (error) {
      if (error instanceof ValidationError) {
        return Response.json({ error: 'Validation', fields: error.fields }, { status: 422 })
      }
      if (error instanceof ConflictError) {
        return Response.json({ error: error.message }, { status: 409 })
      }
      if (error instanceof NotFoundError) {
        return Response.json({ error: 'Introuvable' }, { status: 404 })
      }
      throw error
    }
  })
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return withAdmin(async () => {
    const { id } = await params
    try {
      await deleteProject(id)
      return new Response(null, { status: 204 })
    } catch (error) {
      if (error instanceof NotFoundError) {
        return Response.json({ error: 'Introuvable' }, { status: 404 })
      }
      throw error
    }
  })
}

const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: 'GET, PATCH, DELETE' } })

export const POST = methodNotAllowed
export const PUT = methodNotAllowed
```

---

## Fichier 10 — `app/admin/projects/actions.ts`

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdminApi } from '@/lib/auth/guard'
import {
  createProject,
  updateProject,
  deleteProject,
  ValidationError,
  ConflictError,
} from '@/lib/services/projects'

export type FormState = {
  error?: string
  fields?: Record<string, string[]>
}

/**
 * Transport « formulaire ». Aucune règle métier ici : on traduit un
 * FormData en objet, on appelle le service, on traduit l'erreur en
 * message affichable.
 *
 * requireAdminApi() est appelé explicitement : une Server Action est un
 * point d'entrée HTTP à part entière, appelable directement sans passer
 * par la page qui l'a rendue. Elle doit se protéger elle-même.
 */
function formToObject(formData: FormData) {
  return {
    slug: formData.get('slug'),
    title: formData.get('title'),
    summary: formData.get('summary'),
    content: formData.get('content'),
    role: formData.get('role'),
    domain: formData.get('domain'),
    year: formData.get('year'),
    stack: String(formData.get('stack') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    outcomes: String(formData.get('outcomes') ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    links: {
      live: String(formData.get('linkLive') ?? ''),
      repo: String(formData.get('linkRepo') ?? ''),
    },
    status: formData.get('status'),
    featured: formData.get('featured') === 'on',
    order: formData.get('order'),
  }
}

function toFormState(error: unknown): FormState {
  if (error instanceof ValidationError) {
    return { error: 'Certains champs sont invalides.', fields: error.fields }
  }
  if (error instanceof ConflictError) {
    return { error: error.message }
  }

  const ref = crypto.randomUUID()
  console.error(JSON.stringify({ level: 'error', ref, error: String(error) }))
  return { error: `Une erreur est survenue. Référence : ${ref}` }
}

export async function createProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdminApi()

  try {
    await createProject(formToObject(formData))
  } catch (error) {
    return toFormState(error)
  }

  revalidatePath('/admin/projects')
  revalidatePath('/')
  redirect('/admin/projects')
}

export async function updateProjectAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdminApi()

  try {
    await updateProject(id, formToObject(formData))
  } catch (error) {
    return toFormState(error)
  }

  revalidatePath('/admin/projects')
  revalidatePath('/')
  redirect('/admin/projects')
}

export async function deleteProjectAction(formData: FormData) {
  await requireAdminApi()

  const id = String(formData.get('id') ?? '')
  if (!id) return

  await deleteProject(id)
  revalidatePath('/admin/projects')
  revalidatePath('/')
}
```

---

## Fichier 11 — `app/admin/layout.tsx`

```tsx
import type { ReactNode } from 'react'
import { requireAdminPage } from '@/lib/auth/guard'
import { AdminNav } from '@/components/admin/AdminNav'
import { logoutAction } from './actions'

export const metadata = { robots: { index: false, follow: false } }

/**
 * Le layout appelle requireAdminPage() — mais ce n'est PAS suffisant :
 * chaque page l'appelle aussi.
 *
 * Raison : un layout ne protège que les pages qu'il enveloppe, et rien
 * ne garantit qu'une future route reste dans cet arbre. La protection
 * doit être lisible dans le fichier qu'on ouvre, pas déduite de
 * l'arborescence. Le coût est nul (une lecture de session cachée
 * en Redis), le bénéfice est qu'aucune page ne peut être ajoutée
 * sans protection par inattention.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminPage()

  return (
    <div className="admin" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr' }}>
      <aside
        style={{
          borderRight: 'var(--rule-width) solid var(--color-rule)',
          padding: 'var(--space-8) 0',
          minWidth: '13rem',
          position: 'sticky',
          top: 0,
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '0 var(--space-4) var(--space-6)' }}>
          <span className="mono">Admin</span>
        </div>

        <AdminNav />

        <form action={logoutAction} style={{ marginTop: 'auto', padding: 'var(--space-4)' }}>
          <p className="mono" style={{ marginBottom: 'var(--space-2)' }}>
            {user.email}
          </p>
          <button className="btn" type="submit" style={{ width: '100%' }}>
            Déconnexion
          </button>
        </form>
      </aside>

      <main style={{ minWidth: 0 }}>{children}</main>
    </div>
  )
}
```

## Fichier 12 — `components/admin/AdminNav.tsx`

```tsx
'use client'

// "use client" justifié : usePathname pour marquer le lien actif.
// Aucune donnée, aucun appel réseau — le composant reste minimal.

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/profile', label: 'Profile' },
  { href: '/admin/projects', label: 'Projects' },
  { href: '/admin/experience', label: 'Experience' },
  { href: '/admin/skills', label: 'Skills' },
  { href: '/admin/articles', label: 'Articles' },
  { href: '/admin/media', label: 'Media' },
  { href: '/admin/leads', label: 'Leads' },
  { href: '/admin/messages', label: 'Messages' },
  { href: '/admin/calendar', label: 'Calendar' },
  { href: '/admin/assistant', label: 'AI Assistant' },
  { href: '/admin/analytics', label: 'Analytics' },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Navigation d'administration">
      {LINKS.map(({ href, label }) => {
        const active = href === '/admin' ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className="admin-nav__link"
            aria-current={active ? 'page' : undefined}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
```

---

## Fichier 13 — `app/admin/projects/page.tsx`

```tsx
import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth/guard'
import { listProjectsForAdmin } from '@/lib/services/projects'
import { paginationSchema } from '@/lib/pagination'
import { ProjectRowActions } from '@/components/admin/ProjectRowActions'

export const metadata = { title: 'Projets', robots: { index: false } }

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdminPage() // première ligne, toujours

  const sp = await searchParams
  const pagination = paginationSchema.parse({ page: sp.page, perPage: sp.perPage ?? 20 })
  const { items, page, total, totalPages } = await listProjectsForAdmin(pagination)

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div>
          <h1 className="display display--section">Projets</h1>
          <p className="mono" style={{ marginTop: 'var(--space-2)' }}>
            {total} {total > 1 ? 'entrées' : 'entrée'}
          </p>
        </div>
        <Link href="/admin/projects/new" className="btn btn--primary">
          Nouveau projet
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="prose-body" style={{ color: 'var(--color-ink-muted)' }}>
          Aucun projet pour l'instant. Commencez par en créer un.
        </p>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Année</th>
                <th scope="col">Titre</th>
                <th scope="col">Domaine</th>
                <th scope="col">Statut</th>
                <th scope="col">Ordre</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="mono mono--data">{p.year}</td>
                  <td>
                    <Link href={`/admin/projects/${p.id}`}>{p.title}</Link>
                    {p.featured && (
                      <span className="badge badge--urgent" style={{ marginLeft: 8 }}>
                        Mis en avant
                      </span>
                    )}
                  </td>
                  <td className="mono mono--data">{p.domain}</td>
                  <td>
                    <span
                      className={`badge ${
                        p.status === 'PUBLISHED' ? 'badge--live' : 'badge--draft'
                      }`}
                    >
                      {p.status === 'PUBLISHED' ? 'En ligne' : 'Brouillon'}
                    </span>
                  </td>
                  <td className="mono mono--data">{p.order}</td>
                  <td style={{ textAlign: 'right' }}>
                    <ProjectRowActions id={p.id} title={p.title} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <nav
            aria-label="Pagination"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 'var(--space-6)',
            }}
          >
            <span className="mono">
              Page {page} sur {totalPages} · {total} au total
            </span>
            <span style={{ display: 'flex', gap: 'var(--space-4)' }}>
              {page > 1 && (
                <Link className="mono" href={`/admin/projects?page=${page - 1}`}>
                  ← Précédent
                </Link>
              )}
              {page < totalPages && (
                <Link className="mono" href={`/admin/projects?page=${page + 1}`}>
                  Suivant →
                </Link>
              )}
            </span>
          </nav>
        </>
      )}
    </div>
  )
}
```

## Fichier 14 — `components/admin/ProjectRowActions.tsx`

```tsx
'use client'

import { deleteProjectAction } from '@/app/admin/projects/actions'

/**
 * La suppression demande une confirmation.
 * confirm() natif : c'est une action admin à un seul utilisateur, une
 * modale maison coûterait 80 lignes pour zéro gain fonctionnel.
 */
export function ProjectRowActions({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={deleteProjectAction}
      onSubmit={(e) => {
        if (!confirm(`Supprimer définitivement « ${title} » ?`)) e.preventDefault()
      }}
      style={{ display: 'inline' }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="mono"
        style={{
          background: 'none',
          border: 0,
          cursor: 'pointer',
          color: 'var(--color-vermilion)',
        }}
      >
        Supprimer
      </button>
    </form>
  )
}
```

---

## Fichier 15 — `components/admin/ProjectForm.tsx`

```tsx
'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/admin/projects/actions'

type Project = {
  id?: string
  slug?: string
  title?: string
  summary?: string
  content?: string
  role?: string
  domain?: string
  year?: number
  stack?: string[]
  outcomes?: string[]
  links?: { live?: string; repo?: string }
  status?: string
  featured?: boolean
  order?: number
}

export function ProjectForm({
  action,
  project = {},
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>
  project?: Project
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, {})

  const err = (field: string) => state.fields?.[field]?.[0]

  return (
    <form action={formAction} style={{ maxWidth: '46rem' }}>
      <Field name="title" label="Titre" defaultValue={project.title} error={err('title')} required />
      <Field
        name="slug"
        label="Slug (URL)"
        defaultValue={project.slug}
        error={err('slug')}
        hint="minuscules, chiffres et tirets"
        required
      />
      <Field
        name="summary"
        label="Résumé"
        defaultValue={project.summary}
        error={err('summary')}
        hint="1 à 2 phrases — sert aussi de source au chatbot"
        textarea
        required
      />
      <Field name="role" label="Rôle" defaultValue={project.role} error={err('role')} required />
      <Field name="domain" label="Domaine" defaultValue={project.domain} error={err('domain')} required />
      <Field name="year" label="Année" type="number" defaultValue={project.year} error={err('year')} required />
      <Field
        name="stack"
        label="Stack"
        defaultValue={project.stack?.join(', ')}
        hint="séparée par des virgules"
        error={err('stack')}
      />
      <Field
        name="outcomes"
        label="Résultats"
        defaultValue={project.outcomes?.join('\n')}
        hint="un par ligne"
        textarea
        error={err('outcomes')}
      />
      <Field name="linkLive" label="Lien en ligne" type="url" defaultValue={project.links?.live} />
      <Field name="linkRepo" label="Dépôt" type="url" defaultValue={project.links?.repo} />
      <Field
        name="content"
        label="Contenu détaillé"
        defaultValue={project.content}
        hint="markdown — décisions techniques, contexte, difficultés"
        textarea
        rows={14}
        error={err('content')}
      />

      <div className="field" style={{ marginBottom: 'var(--space-6)' }}>
        <label className="field__label" htmlFor="status">Statut</label>
        <select
          className="field__input"
          id="status"
          name="status"
          defaultValue={project.status ?? 'DRAFT'}
        >
          <option value="DRAFT">Brouillon</option>
          <option value="PUBLISHED">Publié</option>
          <option value="ARCHIVED">Archivé</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
        <label className="mono" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" name="featured" defaultChecked={project.featured} />
          Mis en avant
        </label>
        <Field name="order" label="Ordre" type="number" defaultValue={project.order ?? 0} inline />
      </div>

      {state.error && (
        <p className="field__error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          {state.error}
        </p>
      )}

      <button className="btn btn--primary" type="submit" disabled={pending}>
        {pending ? 'Enregistrement…' : submitLabel}
      </button>
    </form>
  )
}

/** Sous-composant local : garde ProjectForm sous 150 lignes. */
function Field({
  name,
  label,
  defaultValue,
  error,
  hint,
  type = 'text',
  textarea = false,
  rows = 3,
  required = false,
  inline = false,
}: {
  name: string
  label: string
  defaultValue?: string | number
  error?: string
  hint?: string
  type?: string
  textarea?: boolean
  rows?: number
  required?: boolean
  inline?: boolean
}) {
  const id = `field-${name}`
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ')

  return (
    <div className="field" style={{ marginBottom: inline ? 0 : 'var(--space-6)' }}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>

      {textarea ? (
        <textarea
          className="field__input"
          id={id}
          name={name}
          rows={rows}
          defaultValue={defaultValue}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy || undefined}
        />
      ) : (
        <input
          className="field__input"
          id={id}
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy || undefined}
        />
      )}

      {hint && (
        <span className="mono" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
```

## Fichier 16 — `app/admin/projects/new/page.tsx`

```tsx
import { requireAdminPage } from '@/lib/auth/guard'
import { ProjectForm } from '@/components/admin/ProjectForm'
import { createProjectAction } from '../actions'

export const metadata = { title: 'Nouveau projet', robots: { index: false } }

export default async function NewProjectPage() {
  await requireAdminPage()

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">Nouveau projet</h1>
      <hr className="rule" style={{ margin: 'var(--space-6) 0' }} />
      <ProjectForm action={createProjectAction} submitLabel="Créer" />
    </div>
  )
}
```

## Fichier 17 — `app/admin/projects/[id]/page.tsx`

```tsx
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth/guard'
import { getProjectForAdmin, NotFoundError } from '@/lib/services/projects'
import { ProjectForm } from '@/components/admin/ProjectForm'
import { updateProjectAction } from '../actions'

export const metadata = { title: 'Modifier un projet', robots: { index: false } }

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminPage()
  const { id } = await params

  let project
  try {
    project = await getProjectForAdmin(id)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  // bind : l'id est fixé côté serveur, jamais transmis par le formulaire —
  // sinon un utilisateur pourrait modifier le champ caché et écrire ailleurs.
  const action = updateProjectAction.bind(null, id)

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">{project.title}</h1>
      <hr className="rule" style={{ margin: 'var(--space-6) 0' }} />
      <ProjectForm
        action={action}
        submitLabel="Enregistrer"
        project={{
          ...project,
          links: project.links as { live?: string; repo?: string },
        }}
      />
    </div>
  )
}
```

---

## Ajout CSS — `app/globals.css`

```css
/* Classe utilitaire d'accessibilité : masque visuellement, garde pour
   les lecteurs d'écran. Utilisée sur les en-têtes de colonne sans libellé. */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## Tests à passer

```bash
# Connecté dans le navigateur, récupère le cookie puis :
COOKIE="__Host-session=<valeur>"
URL="https://career-platform-pied.vercel.app"

# 1. Liste paginée
curl -s -H "Cookie: $COOKIE" "$URL/api/admin/projects?page=1&perPage=5" | jq

# 2. Plafond de pagination respecté → 400
curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: $COOKIE" \
  "$URL/api/admin/projects?perPage=999999"

# 3. Sans cookie → 401
curl -s -o /dev/null -w "%{http_code}\n" "$URL/api/admin/projects"

# 4. Méthode interdite → 405
curl -s -o /dev/null -w "%{http_code}\n" -X PUT -H "Cookie: $COOKIE" \
  "$URL/api/admin/projects"

# 5. Validation → 422 avec le détail des champs
curl -s -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"title":"x"}' "$URL/api/admin/projects" | jq

# 6. Slug en double → 409
#    (créer un projet valide, puis rejouer la même requête)

# 7. Aucun message Prisma dans les réponses d'erreur
curl -s -H "Cookie: $COOKIE" "$URL/api/admin/projects/inexistant" | grep -i prisma
#    → doit ne rien renvoyer
```

---

## Prompt pour Claude Code

```
Lis CLAUDE.md, docs/03-DESIGN-SYSTEM.md et docs/08-CMS-CODE.md en entier.

Crée les 17 fichiers exactement comme spécifiés, en conservant tous les
commentaires. Ajoute aussi la classe .sr-only à app/globals.css.

Contraintes de vérification :
- npx tsc --noEmit propre
- npm run build propre
- aucun composant au-dessus de 150 lignes (vérifie et dis-le-moi)
- aucun any, aucun @ts-ignore

Puis :
1. npm run dev, connecte-toi, et crée un projet de test réel via
   /admin/projects/new (utilise MyDayPlanner avec de vraies valeurs).
2. Vérifie qu'il apparaît dans la liste, modifie-le, supprime-le.
3. Déploie.
4. Rejoue les 7 tests de la section "Tests à passer" contre la
   production et donne-moi la sortie brute.
5. Vérifie dans Redis que la clé {ENV}:portfolio:version a bien été
   incrémentée à chaque écriture — c'est la preuve que l'invalidation
   de cache fonctionne.
6. Ajoute les résultats dans SECURITY.md (section API) et dans
   ARCHITECTURE.md (section Backend & API : documente la couche service
   et pourquoi elle existe).

Si un test échoue, ARRÊTE-TOI et dis-le-moi.

Commit : "feat: couche service, CRUD projets, API admin et layout"
```

---

## Tes trois questions de contrôle

**Q4.** Pourquoi la logique métier est-elle dans `lib/services/` plutôt que directement
dans les route handlers ? Qu'est-ce que ça empêche concrètement ?

**Q5.** Pourquoi `perPage` est-il plafonné à 100 ? Que se passerait-il sans ce plafond ?

**Q6.** Quand tu modifies un projet dans l'admin, deux choses se déclenchent
automatiquement dans `afterWrite()`. Lesquelles, et pourquoi sont-elles centralisées là
plutôt qu'appelées par chaque transport ?
