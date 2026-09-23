# Base de données

PostgreSQL 18.6 sur Neon (AWS eu-central-1), pgvector 0.8.6 — versions lues en base
(`SELECT version()`, `pg_extension`), pas de mémoire.
24 modèles, 11 énumérations (`prisma/schema.prisma`).

| Domaine | Modèles |
|---|---|
| Auth | `User`, `Session` |
| Contenu (CMS) | `Profile`, `Project`, `Experience`, `Skill`, `Article`, `Media` |
| CRM et messagerie | `Contact`, `Lead`, `LeadNote`, `LeadEvent`, `Conversation`, `Message`, `Notification` |
| Réservation | `Service`, `AvailabilityRule`, `AvailabilityException`, `Appointment`, `CalendarEvent` |
| IA | `KnowledgeChunk`, `ChatSession`, `ChatMessage` |
| Audience | `PageView` |

Énumérations : `Role`, `ContentStatus`, `AppointmentStatus`, `LeadStage`, `LeadSource`,
`MessageDirection`, `ConversationStatus`, `NotificationType`, `CalendarEventKind`,
`KnowledgeSourceType`, `ChatRole`.

## Le principe directeur : Contact est le pivot

```
                   Contact  (email @unique)
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
        Lead         Conversation      Appointment
       ┌──┴──┐            │                │
       ▼     ▼            ▼                ▼
  LeadEvent LeadNote    Message       CalendarEvent
```

`Contact` représente la PERSONNE, identifiée par son email (`@unique`).
`Lead` représente l'OPPORTUNITÉ commerciale.

Séparer les deux permet de répondre à « montre-moi tout l'historique de cette
personne » — la question que pose n'importe quel CRM. Dupliquer nom et email
dans `leads`, `messages` et `appointments` aurait créé trois sources de vérité
qui divergent. Le formulaire de contact et la réservation font tous deux un
`upsert` sur `Contact.email` : la même personne qui écrit puis réserve n'existe
qu'une fois. Les suppressions descendent en cascade (`onDelete: Cascade`) depuis
`Contact` ; `Appointment → Service` est en `Restrict` — on ne supprime pas un
service qui a des rendez-vous.

## Les objets que Prisma ne sait pas exprimer

Créés en SQL manuel (`prisma/migrations/*_pgvector_and_indexes`), lus en base via
`pg_indexes` :

| Objet | Définition réelle | Pourquoi il est en SQL manuel |
|---|---|---|
| `knowledge_chunks_embedding_hnsw_idx` | `USING hnsw (embedding vector_cosine_ops) WITH (m='16', ef_construction='64')` | index HNSW, non exprimable en Prisma |
| `knowledge_chunks_tsv_idx` | `USING gin (tsv)` | index GIN sur colonne générée |
| `knowledge_chunks.tsv` | `GENERATED ALWAYS AS (…) STORED`, français, titre pondéré A / contenu B | colonne générée |
| `appointments_active_slot_idx` | `UNIQUE … USING btree ("startsAt") WHERE status IN ('PENDING','CONFIRMED')` | index UNIQUE **partiel** |
| `page_views_created_brin_idx` | `USING brin ("createdAt")` | index BRIN |

`npm run verify:db` vérifie les quatre premiers en base et sort en erreur si un seul
manque (le BRIN, sur une table encore vide, n'est pas contrôlé). La discipline ne
suffit pas : une vérification automatique, si. Prisma voit ces objets comme une
dérive et propose de les supprimer à chaque `migrate dev` — d'où la procédure
`--create-only` imposée (README § Migrations).

## L'index unique partiel

```sql
CREATE UNIQUE INDEX appointments_active_slot_idx
  ON appointments ("startsAt")
  WHERE status IN ('PENDING', 'CONFIRMED');
```

Une contrainte `UNIQUE` totale s'appliquerait aussi aux rendez-vous annulés :
un créneau annulé serait bloqué définitivement. L'index partiel ne contraint
que les rendez-vous vivants. Prouvé en production (SECURITY.md § Invariants
métier) : après annulation, le même `startsAt` porte une ligne `CANCELLED` et une
nouvelle ligne `PENDING`, sans violation.

## Le vecteur

`embedding vector(1536)` — et non 3072, la sortie native de Gemini.
Raison : l'index HNSW de pgvector plafonne à **2000 dimensions** pour le type
`vector`. Un embedding en 3072 serait stocké mais non indexable, et la
recherche tomberait en scan séquentiel sans aucune erreur.

Gemini ne normalise pas les sorties tronquées : norme L2 mesurée **0.6922**
(`npm run check`, 23/09/2026). Chaque vecteur est normalisé côté serveur avant
stockage et avant comparaison.

Prisma ne connaît pas le type `vector` : le champ est déclaré `Unsupported()`
et reste invisible au client généré. Lectures et écritures passent par
`$queryRaw` / `$executeRaw` avec un cast `::vector`, en requêtes **préparées**
— jamais `$executeRawUnsafe`. Seule exception : la dimension du cast
(`vector(1536)`) est injectée en SQL littéral via `Prisma.raw`, Postgres
refusant un paramètre lié à cette position (erreur 42601) ; c'est une
constante du code, jamais une entrée utilisateur.

## Index et requêtes

| Index | Requête couverte | EXPLAIN ANALYZE |
|---|---|---|
| `Project @@index([status, featured, order])` | index public : `WHERE status = 'PUBLISHED' ORDER BY featured DESC, order ASC` | non mesuré (6 lignes) |
| `Experience @@index([status, startDate desc])` | trajectoire publique : publiées, les plus récentes d'abord | non mesuré |
| `Skill @@index([category, order])` | terrain : regroupement par catégorie | non mesuré |
| `Article @@index([status, publishedAt desc])` | articles publiés, du plus récent au plus ancien | non mesuré |
| `Lead @@index([stage, position])` | pipeline CRM : une colonne par étape, ordonnée | non mesuré |
| `Conversation @@index([status, lastMessageAt desc])` | liste des messages admin | non mesuré |
| `Notification @@index([readAt, createdAt desc])` | notifications non lues, les plus récentes | non mesuré |
| `Appointment @@index([status, startsAt])` | disponibilités : rendez-vous vivants sur l'horizon | non mesuré |
| `Session @@index([expiresAt])` | balayage des sessions expirées | non mesuré |
| `KnowledgeChunk @@unique([sourceType, sourceId, contentHash])` | réindexation incrémentale : chunk inchangé ? | non mesuré |
| `knowledge_chunks_embedding_hnsw_idx` | branche vectorielle de la recherche hybride | **oui** — PERFORMANCE.md § Index vectoriel |

Seul l'index vectoriel a été mesuré : à 30 chunks, le planificateur choisit un Seq
Scan (moins cher), et `SET enable_seqscan = off` prouve que l'index HNSW est
utilisable. Les autres tables comptent quelques lignes : un `EXPLAIN` y montrerait
un Seq Scan quel que soit l'index, et ne prouverait rien.

## Transactions

| Opération | Tables touchées | Pourquoi une transaction |
|---|---|---|
| Contact entrant (`lib/services/contact.ts`) | 6 — Contact, Conversation, Message, Lead, LeadEvent, Notification | un message sans prospect est invisible |
| Réservation (`lib/services/booking.ts`) | 4 — Contact, Appointment, CalendarEvent, Notification | un rendez-vous sans événement d'agenda est fantôme |
| Annulation par token | 3 — Appointment, CalendarEvent, Notification | un créneau libéré doit disparaître de l'agenda en même temps |
| Changement d'étape CRM | 2 — Lead, LeadEvent | un audit qui diverge de l'état n'a aucune valeur |
| Note CRM | 3 — LeadNote, LeadEvent, Lead (`lastActivityAt`) | idem |
| Ouverture d'une conversation | 3 — Conversation, Message, Notification | non-lus et notifications soldés ensemble |
| Liste paginée des messages | 2 lectures (page + `count`) | le compte et la page viennent du même instantané |

## Données personnelles

Aucune IP en clair n'est stockée. Le rate limiting (connexion, chat, contact,
réservation) utilise un hash `sha256(ip | jour | secret)` tronqué
(`lib/request.ts`), et `ChatSession.visitorKey` reçoit ce même hash.

Les tokens de session sont stockés hachés en SHA-256 (`Session.tokenHash`) — un
dump de la base ne donne aucune session réutilisable ; le token brut n'existe que
dans le cookie.

`PageView` est conçu sur le même principe — `sessionHash = sha256(ip + userAgent
+ sel_quotidien)` tronqué à 16 caractères, pour compter des visiteurs uniques sur
24 h sans pouvoir remonter à une personne. **La collecte n'est pas implémentée** :
la table existe, aucune visite n'y est encore écrite.
