# Architecture

Next.js 16 (App Router) · TypeScript strict · Prisma + PostgreSQL (Neon, pgvector) · Redis
(Upstash) · Gemini · Vercel. Chaque décision structurante est reprise, avec sa justification
et l'alternative écartée, dans la dernière section.

---

## Frontend

**Server Components par défaut.** Toutes les sections publiques (Ouverture, Travaux,
Trajectoire, Terrain) sont des Server Components. Deux composants seulement sont des Client
Components sur l'accueil : `ChatPanel` (conversation, saisie, appel réseau) et `ContactForm`
(état d'envoi) — chacun porte en tête la justification de son `"use client"`.

**Motion en CSS, pas en JavaScript (D8).** Entrée au scroll par `animation-timeline: view()`
(classe `.enter`), révélation typographique masquée, View Transitions natives entre l'index et
la page projet (`viewTransitionName` partagé sur le titre). `prefers-reduced-motion` coupe
tout. Aucune bibliothèque d'animation.

**Direction artistique « Dossier technique ».** Encre sur papier, tokens CSS (`app/globals.css`)
— aucune valeur brute de couleur ou de taille dans un composant. `SectionFrame` encode la grille
signature : colonne de métadonnées sticky en marge + contenu ancré asymétriquement. Cette
colonne n'est jamais soumise au fondu d'entrée : appliqué à toute la section, il la rendait
illisible avant le scroll (contraste 1.15 relevé par Lighthouse) ; `.enter` ne porte que sur
le corps.

**Index des travaux en table (D15), Markdown sans HTML (D14).** L'index est une vraie `<table>`
sémantique. Le contenu des projets est rendu par `react-markdown`, qui produit des éléments
React et non une chaîne HTML : aucun `dangerouslySetInnerHTML` dans le projet.

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
2. `onContentChanged()` — réindexation RAG : la base de connaissances du chatbot doit suivre le
   CMS, sinon il répond sur des données mortes.

### D12 — Pagination obligatoire et plafonnée

Toute liste exposée est paginée côté serveur, `page` et `perPage` validés par Zod
(`lib/pagination.ts`) et plafonnés à 100. Sans ce plafond, `?perPage=999999` charge toute la
table en mémoire serveur en une seule requête — un déni de service trivial. Vérifié en
production : `perPage=999999` renvoie 400, pas une liste de 999999 lignes.

### Routes publiques

| Route | Rôle | Protections |
|---|---|---|
| `POST /api/chat` | question au chatbot | Zod (3-500 car.), corps ≤ 8 Ko, rate limit 10/h/visiteur + 30/h/IP, 503 explicite si Gemini indisponible |
| `POST /api/contact` | contact entrant | Zod, corps ≤ 16 Ko, rate limit 3/h, champ piège silencieux (201 sans écriture) |
| `POST /api/booking` | réservation | Zod, revalidation serveur du créneau, verrou + index partiel, 409 sur collision, rate limit 5/h |
| `POST /api/booking/cancel/[token]` | annulation | token opaque, `GET` refusé (405) |

Toutes renvoient 405 sur les méthodes non prévues, et un message générique avec un `ref` de
corrélation sur erreur interne — le détail reste dans les logs serveur.

---

## Base de données (Prisma / Neon)

Détail complet dans [DATABASE.md](./DATABASE.md). Les points structurants :

- **`Contact` est le pivot** : la personne existe une fois (email unique), rattachée à ses
  prospects, conversations et rendez-vous.
- **Cinq objets en SQL manuel** que Prisma ne sait pas exprimer : index HNSW, index GIN, colonne
  `tsv` générée, index unique partiel sur les rendez-vous, index BRIN. `npm run verify:db` en
  contrôle quatre ; `prisma migrate dev` est interdit (il propose de les supprimer), la
  procédure `--create-only` + relecture du SQL est imposée.
- **Transactions** sur toute écriture multi-tables : contact entrant (6 tables), réservation
  (4), changement d'étape CRM avec son audit (2).
- **Neon** : `DATABASE_URL` poolée pour le runtime, `DIRECT_URL` directe pour les migrations.

---

## Infrastructure (Redis, cache, déploiement)

**Isolation par environnement (Redis).** Une seule base Upstash sert le dev, les preview et
la production. Sans préfixe, un test local consomme le quota de rate limit de production et
invalide le cache des visiteurs réels. Toutes les clés Redis (`lib/redis.ts`) sont préfixées
par `ENV = process.env.VERCEL_ENV ?? 'dev'` (`production` | `preview` | `dev`) : rate limit de
login, cache versionné du portfolio, compteur d'événements, verrou de créneau, cache de
session.

**Redis : cinq usages (D5).**
1. Rate limiting à fenêtre glissante — connexion (IP + compte), chat, contact, réservation.
2. Cache des lectures publiques, invalidé par version (D13).
3. Compteur d'événements lu par la cloche de notifications de l'admin.
4. Verrou de créneau anti double-réservation (D6).
5. Cache de session en lecture, TTL 60 s — la source de vérité reste Postgres, la révocation
   reste quasi immédiate.

**D13 — Invalidation de cache par version.** `bumpCacheVersion()` est appelée par
`afterWrite()`, jamais directement par un transport — encore une conséquence de D11 : si
l'invalidation vivait dans chaque route handler, l'oublier dans un seul suffirait à servir du
contenu périmé.

**Déploiement.** Vercel, déploiement automatique à chaque `git push` sur `main`. `postinstall:
prisma generate` est indispensable : Vercel réutilise `node_modules` en cache et ne régénère
pas le client Prisma de lui-même — quatre builds ont échoué (`TS2339` sur un champ ajouté au
schéma) avant ce correctif. `proxy.ts` (ex-`middleware.ts`) ne fait qu'en-têtes HTTP et
redirection de confort ; ce n'est pas une frontière de sécurité (D1).

---

## Intelligence artificielle (RAG, Gemini)

```
CONTENU CMS ──► chunking structurel ──► embedding 1536 + L2 ──► knowledge_chunks
                                                                (HNSW + tsvector)
QUESTION ──► embedding ──► vectoriel top 20 ─┐
         └──────────────► lexical top 20 ───┴► RRF ► top 6
                                                     │
                     distance cosinus > 0.36 ? ── oui ──► REFUS (sans appeler Gemini)
                                                     │ non
                                                     ▼
                                   cascade Gemini ─► réponse + sources cliquables
```

**Chunking structurel.** Chaque entité produit 1 à 3 chunks sémantiquement complets (un projet :
identité, résultats, détails techniques), citables et réindexés de façon incrémentale par
`contentHash`. 30 chunks à l'indexation initiale.

**Embeddings.** `gemini-embedding-001` en 1536 dimensions, normalisation L2 côté serveur (norme
mesurée des sorties : 0.6922), `taskType` asymétrique (`RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY`).

**Recherche hybride.** Vectorielle (cosinus) et lexicale (tsvector français) en parallèle,
fusionnées par Reciprocal Rank Fusion (`k = 60`).

**Refus déterministe sur la distance cosinus.** Le seuil RRF initial était inerte : le RRF note
un rang, et le rang 1 vaut toujours 1/61 ≈ 0.0164, pertinent ou non (mesuré : 0.01639 pour 7
questions sur 7). Le refus porte désormais sur la distance cosinus du chunk le plus proche,
`MAX_COSINE_DISTANCE = 0.36`, calibré sur mesures (PERFORMANCE.md § Calibrage). Le RRF ordonne,
la distance cosinus qualifie.

**Défense contre le prompt injection.** Contexte dans un bloc délimité, déclaré comme donnée
et jamais comme instruction ; cadre fermé (rien hors contexte) ; refus en amont dans le code ;
clé Gemini côté serveur uniquement ; sortie rendue en texte échappé.

### Cascade de modèles Gemini

Le tier gratuit Gemini renvoie des 503 par intermittence. Quatre modèles ont été mesurés le
23/09 : tous les flash-lite en 503, gemini-3.5-flash répondant en 22 s. Une cascade bascule sur
le modèle suivant dès le premier 503, sans attente, dans un budget de 45 s. En dernier recours,
l'API renvoie un 503 explicite plutôt qu'une erreur générique — une indisponibilité amont n'est
pas un défaut applicatif.

Mise en œuvre (`lib/rag/answer.ts`, `generateWithFallback`) : ordre `gemini-3.5-flash` →
`gemini-3.5-flash-lite`. Le SDK ne relance
jamais de lui-même (`retryOptions: { attempts: 1 }` explicite) et chaque appel reçoit comme
timeout le budget **restant**, pas un budget par modèle. Chaque bascule est journalisée
(`{ level: 'warn', scope: 'chat.fallback', from, to, status }`). Si tout échoue,
`ModelUnavailableError` → `app/api/chat/route.ts` renvoie `503` avec `retryable: true`, que
l'interface affiche comme « Assistant · indisponible », distinct d'une erreur technique.

La bascule porte sur 429 et tout 5xx amont — y compris sur l'embedding de la question, lui
aussi servi par Gemini. Un 4xx, en revanche, n'est **pas** contourné : c'est une requête
invalide de notre part. C'est ce choix qui a permis de trouver que `gemini-3.5-flash-lite`
rejette `thinkingBudget: 0` (400) ; une cascade qui avalerait les 4xx l'aurait masqué derrière
un « service indisponible ». D'où une configuration de raisonnement par modèle
(PERFORMANCE.md § Latence Gemini).

**Pourquoi deux modèles et pas quatre.** La cascade a d'abord compté quatre modèles. En local,
elle répondait 4 fois sur 4 (bascule de 3.5-flash vers 3.5-flash-lite, visible dans les logs) ;
en production, `test:rag` renvoyait encore des 500. Hypothèse : sous plus de charge, la
production descend plus bas dans la cascade, jusqu'à `gemini-3.1-flash-lite` et
`gemini-3.8-flash` — les deux seuls modèles dont la configuration n'a jamais pu être vérifiée,
et qui n'ont **jamais** répondu de la journée (toujours 503/429). Ils n'apportaient aucune
disponibilité mesurée, seulement le risque d'un 400. La cascade ne garde que les deux modèles
qui ont répondu et dont la configuration est mesurée ; au-delà, le 503 explicite fait son
travail.

### Bug trouvé — réindexation par entité, pas par chunk

`upsertChunk()` (`lib/rag/index.ts`) supprimait les chunks existants par `(sourceType,
sourceId)` **à l'intérieur de la boucle sur les chunks**, avant d'insérer le chunk courant.
Or une même entité — un projet — produit jusqu'à 3 chunks (identité, résultats, détails
techniques) partageant le même `sourceId`. Le 2e chunk d'un projet supprimait donc le 1er,
tout juste inséré dans la même exécution ; le 3e supprimait le 2e. Résultat : `reindexAll()`
rapportait 30 chunks « écrits », mais seulement 18 survivaient réellement en base — un seul
chunk par projet au lieu de trois, sans la moindre erreur.

C'est exactement le type de bug que ce module dénonce ailleurs (normalisation L2, `taskType`
inversé) : le RAG « marche » et classe mal, silencieusement. Il n'a été découvert qu'en
recomptant les lignes en base après indexation, pas en lisant les logs.

**Correctif.** `reindexAll()` regroupe désormais les chunks par entité (`sourceType:sourceId`)
avant de les traiter. `upsertEntityChunks()` reçoit tous les chunks d'une même entité, compare
l'ensemble de leurs hash à l'existant (inchangé → aucun appel API, comme avant), et si l'un
d'eux a changé, supprime **une seule fois** puis réinsère l'ensemble des chunks frais de cette
entité. Vérifié après correction : 30 chunks écrits = 30 chunks en base ; un second run
(contenu inchangé) rapporte 0 écrit / 30 ignorés, confirmant l'idempotence.

---

## Sécurité

Détail, commandes reproductibles et sorties dans [SECURITY.md](./SECURITY.md). Les points
structurants :

- **Autorisation au contact de la donnée** : `requireAdminPage()` / `requireAdminApi()` en
  première ligne de chaque page et route admin ; `curl /api/admin/projects` sans cookie → 401.
- **Auth maison** : Argon2id, sessions opaques dont seul le hash SHA-256 est stocké, cookie
  `__Host-` `httpOnly` `Secure` `SameSite=Lax`, aucune route d'inscription, rate limit du login
  par IP et par compte.
- **Zod sur toute entrée**, messages d'erreur génériques côté client, aucun
  `dangerouslySetInnerHTML`.
- **Invariants métier prouvés en production** : réservations simultanées → `409 201` ;
  annulation → créneau libéré et réservable.
- **Deux incidents documentés** : exposition de `.env` dans la source de déploiement CLI
  (rotation des 6 secrets), quota de rate limit partagé entre environnements.

---

## Performance

Mesures, plans d'exécution et audit Lighthouse dans [PERFORMANCE.md](./PERFORMANCE.md). Les
points structurants :

- **Index vectoriel** : HNSW créé et fonctionnel ; à 30 chunks le planificateur préfère
  légitimement un Seq Scan (coût 9.42 contre 138.59), prouvé par `enable_seqscan = off`.
- **Cache versionné** : lectures publiques servies depuis Redis (TTL 300 s), invalidation
  globale par un seul `INCR`.
- **Latence Gemini** : de 14 s à 289 s mesurés selon la charge ; réponses tronquées corrigées en
  désactivant le raisonnement interne, qui consommait 381 des 400 tokens de sortie.
- **JS client minimal** : motion en CSS, deux Client Components sur l'accueil.

---

## Décisions techniques

| # | Décision | Justification | Alternative écartée |
|---|---|---|---|
| D1 | Autorisation dans `requireAdmin()`, au contact de la donnée | le middleware/proxy a déjà été contourné (CVE-2026-64642) ; un contrôle d'accès ne dépend pas d'une couche que le framework peut court-circuiter | autorisation dans `middleware.ts` |
| D2 | Auth maison : sessions opaques hachées, Argon2id, aucune inscription | un seul utilisateur ; une abstraction non écrite se défend mal ; ce qui n'existe pas ne s'exploite pas | NextAuth / Auth.js |
| D3 | Chunking structurel par entité (1 à 3 chunks) | chunks citables, compréhensibles seuls, réindexation incrémentale par hash | découpage fixe à N caractères |
| D4 | Notifications par version Redis, interrogée toutes les 10 s | WebSocket impossible en serverless ; SSE prévu mais coupé sous contrainte de temps ; la lecture de version évite toute requête Postgres à vide | WebSocket ; polling de Postgres |
| D5 | Redis pour cinq usages (débit, cache, événements, verrou, sessions) | chaque usage a sa justification propre, préfixé par environnement | Redis limité au rate limiting |
| D6 | Double rempart : verrou Redis + index unique **partiel** | le verrou est une optimisation, l'index est la garantie ; partiel pour qu'une annulation libère le créneau | verrou Redis seul (un invariant ne repose pas sur un cache) ; `UNIQUE` total (bloque le créneau après annulation) |
| D7 | Uploads : magic bytes, allowlist, ré-encodage Sharp — **non livré** | le ré-encodage est la vraie sanitisation d'un fichier polyglotte | confiance dans l'extension ou le `Content-Type` |
| D8 | Motion en CSS scroll-driven | 0 Ko de JS d'animation, sections restées Server Components | Framer Motion (~35 Ko gzip, `"use client"` partout) |
| D9 | Pas de dark mode | l'identité repose sur un rapport encre/papier précis ; le temps est allé au RAG | toggle de thème |
| D10 | Audience sans IP brute (hash à sel quotidien) — **non livré** | compter des visiteurs uniques sans pouvoir remonter à une personne | stockage de l'IP |
| D11 | Une couche de service, deux transports | la logique métier n'existe qu'une fois ; aucun chemin ne peut diverger | logique dupliquée dans Server Actions et route handlers |
| D12 | Pagination serveur plafonnée à 100 | `perPage=999999` serait un déni de service en une requête | listes non bornées |
| D13 | Invalidation de cache par version (`INCR`) | tout le cache devient inatteignable d'un coup, aucune clé à oublier | `SCAN` + `DEL` clé par clé |
| D14 | Markdown rendu par `react-markdown`, sans `rehype-raw` | produit des éléments React, pas du HTML : rien à assainir | chaîne HTML + `dangerouslySetInnerHTML` et sanitizer |
| D15 | Index des travaux en `<table>` | sémantique tabulaire annoncée par les lecteurs d'écran ; le sujet exclut une page de cartes | grille de cartes |
| D16 | Sections publiques en Server Components | quasi aucun JS livré, données lues côté serveur | sections client avec fetch côté navigateur |
| D17 | Embeddings en 1536 dimensions | HNSW plafonne à 2000 dimensions pour `vector` : 3072 serait non indexable | 3072 natif ; `halfvec(3072)` (gain marginal, complexité en plus) |
| D18 | Normalisation L2 côté serveur | Gemini ne normalise pas les sorties tronquées (norme 0.6922) : sans elle le cosinus est faux, sans erreur | faire confiance à la sortie brute |
| D19 | Recherche hybride fusionnée par RRF | le vectoriel rate noms propres et acronymes ; RRF fusionne des rangs sans poids arbitraire | vectoriel seul ; somme pondérée de scores |
| D20 | Refus dans le code, sur la distance cosinus | un prompt se contourne, un `if` non ; le rang RRF ne mesure pas la pertinence | refus par consigne de prompt ; seuil sur le score RRF (mesuré inerte) |
| D21 | Cascade de 2 modèles Gemini, 503 explicite en dernier recours | le tier gratuit renvoie des 503 ; seuls ces deux modèles ont répondu, configuration vérifiée | modèle unique ; cascade de 4 avec modèles non vérifiés |
| D22 | Contact entrant en une transaction (6 tables) | un état partiel serait invisible et non rattrapable | écritures successives |
| D23 | Champ piège silencieux sur le formulaire de contact | anti-spam à coût nul ; répondre 201 n'apprend rien au robot | CAPTCHA ou service tiers ; 422 nommant le champ |
| D24 | Pipeline CRM par boutons de changement d'étape | exigence : un pipeline fonctionnel, pas une interaction | glisser-déposer (bibliothèque cliente, ~1 h, 0 point) |
| D25 | Réservation : liste des 7 prochains jours, annulation par token opaque en `POST` | le cœur est le calcul serveur et la non-collision ; un `GET` ne doit pas modifier d'état | vue calendrier mensuelle ; annulation par `GET` ou par identifiant séquentiel |
