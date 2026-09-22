# Architecture — Personal Career Platform

## Infrastructure

**Isolation par environnement (Redis).** Une seule base Upstash sert le dev, les preview et
la production. Sans préfixe, un test local consomme le quota de rate limit de production et
invalide le cache des visiteurs réels. Toutes les clés Redis (`lib/redis.ts`) sont préfixées
par `ENV = process.env.VERCEL_ENV ?? 'dev'` (`production` | `preview` | `dev`) : rate limit de
login, cache versionné du portfolio, compteur d'événements SSE, verrou de créneau, cache de
session.

---

## Backend & API

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

**Pourquoi elle existe.** Le sujet évalue l'API *et* l'espace admin. Écrire la logique métier
deux fois (une fois dans les Server Actions du formulaire, une fois dans les route handlers de
l'API) garantit qu'elles divergeront tôt ou tard : un bug corrigé d'un côté survit de l'autre.
`lib/services/projects.ts` centralise validation Zod, transaction Prisma, invalidation de
cache et réindexation RAG — **une seule fois**. Les deux transports (`app/admin/projects/actions.ts`
et `app/api/admin/projects/`) ne font que traduire une entrée (FormData ou JSON) et formater
une sortie (redirection ou réponse HTTP) ; ils ne contiennent aucune règle métier.

Conséquence directe, vérifiée en pratique le 22/09/2026 : un projet créé via `/admin/projects/new`
(formulaire) et un projet créé via `POST /api/admin/projects` (curl) passent par la même
fonction `createProject()`, avec la même validation, la même transaction, la même invalidation
de cache. Aucun chemin ne peut diverger de l'autre parce qu'il n'y a physiquement qu'un seul
chemin après le transport.

**Erreurs typées, jamais de message Prisma au client.** `ValidationError`, `ConflictError`,
`NotFoundError` sont levées par le service et traduites par chaque transport dans son propre
vocabulaire (422/409/404 pour l'API, état de formulaire pour l'admin). `translatePrismaError()`
intercepte les codes Prisma (`P2002`, `P2025`) avant qu'un message brut (« Unique
constraint failed on the fields: (`slug`) ») n'atteigne le client et révèle la structure
des colonnes. Vérifié : `grep -i prisma` sur une réponse d'erreur en production ne renvoie rien.

**Effets de bord centralisés dans `afterWrite()`.** Chaque écriture (création, mise à jour,
suppression) déclenche deux effets, au même endroit, pour qu'aucun transport ne puisse les
oublier :
1. `bumpCacheVersion()` — `INCR {ENV}:portfolio:version` invalide tout le cache versionné d'un
   coup (D13).
2. `onContentChanged()` — point d'accroche de la réindexation RAG (implémentée au bloc 3) :
   la base de connaissances du chatbot doit suivre le CMS, sinon il répond sur des données
   mortes.

### D12 — Pagination obligatoire et plafonnée

Toute liste exposée est paginée côté serveur, `page` et `perPage` validés par Zod
(`lib/pagination.ts`) et plafonnés à 100. Sans ce plafond, `?perPage=999999` charge toute la
table en mémoire serveur en une seule requête — un déni de service trivial. Vérifié en
production : `perPage=999999` renvoie 400, pas une liste de 999999 lignes.

### D13 — Invalidation de cache par version

Voir § Infrastructure ci-dessus. `bumpCacheVersion()` est appelée par `afterWrite()`, jamais
directement par un transport — encore une conséquence de D11 : si l'invalidation vivait dans
chaque route handler, l'oublier dans un seul suffirait à servir du contenu périmé.
