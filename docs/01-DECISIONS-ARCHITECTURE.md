# Décisions d'architecture — Personal Career Platform

> Ce fichier est la matrice de ton futur `ARCHITECTURE.md` et le script de ta soutenance.
> Chaque décision est formulée en **choix → justification → ce que je répondrais si on me challenge**.
> Vérifié le 22/09/2026.

---

## État de la stack au 22/09/2026 (vérifié, pas de mémoire)

| Élément | Version / ID à utiliser | Note |
|---|---|---|
| Next.js | **16.3.x** (dernière ligne stable, 16.3 sortie le 03/08/2026) | Une mise à jour de sécurité **16.3.6** a été annoncée le 21/09/2026 — installe-la dès qu'elle est publiée et **mentionne-le dans SECURITY.md** |
| Gemini — chat | `gemini-3.5-flash-lite` (défaut) ou `gemini-3.6-flash` | Flash-lite suffit largement pour du RAG ancré ; latence et coût divisés |
| Gemini — embeddings | `gemini-embedding-001`, `outputDimensionality: 1536`, `taskType` | 2 048 tokens d'entrée max, dimension native 3 072, tronquable (MRL) |
| pgvector sur Neon | `vector(1536)` + index **HNSW** `vector_cosine_ops` | HNSW plafonne à **2 000 dimensions** pour `vector` → 3 072 natif est **non indexable** |
| Redis | Upstash + `@upstash/ratelimit` | REST-based, compatible serverless |
| Stockage médias | Vercel Blob | Chemin le plus court avec l'hébergement imposé |

---

## D1 — Le middleware n'est PAS une frontière de sécurité

**Choix.** Le `middleware.ts` ne fait que deux choses : poser les headers HTTP et rediriger un visiteur non connecté vers `/login` (pur confort UX). **Toute** l'autorisation réelle passe par une fonction `requireAdmin()` appelée à l'intérieur de chaque Server Component de `/admin` et au début de chaque route handler `/api/admin/*`.

**Justification.** Le middleware Next.js s'exécute avant le routage et a déjà été contourné : **CVE-2026-64642** (Next.js 16.0.0 → 16.2.10) permet à une requête forgée de sauter toute vérification d'autorisation vivant dans le middleware. La recommandation officielle est explicite : déplacer les contrôles dans le data-fetching côté serveur. Un contrôle d'accès ne doit jamais dépendre d'une couche que le framework peut court-circuiter.

**Si on te challenge.** Montre-leur en direct : `curl -i https://<ton-domaine>/api/admin/projects` sans cookie → **401**, pas une redirection. Puis : "si mon autorisation était dans le middleware, ce endpoint serait exposé au premier bypass de routage. Elle est au contact de la donnée."

> C'est ta décision la plus rentable à l'oral. Elle coûte 20 lignes de code et te distingue immédiatement d'un candidat qui a mis `if (!session) redirect()` dans le middleware et s'est cru protégé.

---

## D2 — Auth maison, pas NextAuth/Auth.js

**Choix.** Sessions opaques stockées en base, cookie `httpOnly` + `SameSite=Lax` + `Secure` + `__Host-` prefix. Hash de mot de passe **Argon2id** via `@node-rs/argon2`. **Aucune route d'inscription** : un unique compte admin créé par le script de seed.

**Justification.** Trois raisons, dans cet ordre :
1. Le sujet demande de **défendre** le RBAC à l'oral. Une couche d'abstraction que je n'ai pas écrite est une couche que je défends mal.
2. Il y a exactement **un** utilisateur. Tout le poids de NextAuth (providers, callbacks, adapters, JWT strategy) sert un besoin que je n'ai pas.
3. Surface d'attaque : pas de route `/api/auth/[...nextauth]` exposant des flux que je n'utilise pas, pas d'inscription publique, pas de reset de mot de passe. **Ce qui n'existe pas ne s'exploite pas.**

**Détail qui compte.** En base, je stocke le **hash SHA-256 du token de session**, pas le token. Si un dump de la DB fuite, les sessions volées sont inutilisables. Le token brut n'existe que dans le cookie.

**Risque + plan B.** `@node-rs/argon2` embarque des binaires natifs. Si le build Vercel casse (15 min de debug max), bascule sur `bcryptjs` (JS pur, cost 12) et note le trade-off dans `SECURITY.md`. Ne perds pas 2h là-dessus.

**Rate limiting du login.** Double fenêtre Redis : **par IP** (10 tentatives / 15 min) **et par compte** (5 / 15 min). Le second est celui qui compte : un attaquant distribué change d'IP, pas de cible. Réponse et timing identiques que le compte existe ou non.

---

## D3 — RAG : pgvector sur Neon + recherche hybride + refus déterministe

C'est le module à 15 points et celui où la majorité des candidats livrera un `prompt + JSON.stringify(profile)` déguisé. Trois décisions l'en séparent.

### D3.1 — Dimension 1536, pas 3072, avec re-normalisation

`gemini-embedding-001` sort **3 072 dimensions** par défaut. L'index **HNSW de pgvector plafonne à 2 000 dimensions** pour le type `vector` : un embedding natif est donc **non indexable** — tu te retrouverais en scan séquentiel sans t'en rendre compte, et tu ne le verrais pas sur 200 chunks.

→ `outputDimensionality: 1536` (dimension recommandée par la MRL de Gemini), stockée en `vector(1536)`, index HNSW cosine.

**Le piège mortel :** Gemini **ne re-normalise pas** les sorties tronquées. Un vecteur non normalisé fausse la distance cosinus de façon silencieuse — le RAG « marche » mais classe mal. Tu **dois** appliquer une normalisation L2 côté serveur après chaque appel d'embedding, à l'indexation comme à la requête.

```ts
function l2normalize(v: number[]): number[] {
  const n = Math.hypot(...v);
  return n === 0 ? v : v.map((x) => x / n);
}
```

*(Alternative documentable : `halfvec(3072)`, indexable jusqu'à 4 000 dims, ~même coût mémoire que `vector(1536)`. Mentionne-la dans ARCHITECTURE.md comme option écartée — ça montre que le choix était informé.)*

### D3.2 — Recherche hybride (vectoriel + plein texte) fusionnée par RRF

La recherche purement vectorielle **rate les noms propres, les acronymes et les identifiants** : « HECM », « MQL5 », « ColocBenin », « Deriv » sont mal représentés dans un espace d'embeddings. C'est exactement le type de question qu'un recruteur pose.

→ Deux recherches en parallèle sur la même table :
- vectorielle : `embedding <=> $1::vector` (cosine), top 20
- lexicale : `tsv @@ websearch_to_tsquery('french', $1)` avec `ts_rank_cd`, top 20

Fusionnées par **Reciprocal Rank Fusion** (`score = Σ 1/(60 + rang)`), top 6 retenus. ~40 lignes de SQL, et ça transforme la qualité perçue du chatbot. **Quasi personne ne fera ça en 24h.**

### D3.3 — Le refus est codé, pas prompté

Le sujet exige que le chatbot ne hallucine jamais. Déléguer ça au prompt système, c'est espérer. Le refus doit être une **branche de code** :

```
si (meilleur_score_RRF < SEUIL)  →  retourner la réponse de refus SANS appeler Gemini
```

Deux bénéfices : le refus est déterministe et testable, et tu économises un appel API. À l'oral : *« mon garde-fou anti-hallucination s'exécute avant le modèle, pas dedans — un prompt système se contourne, un `if` non. »*

### D3.4 — Chunking structurel, pas par nombre de caractères

Pas de découpage aveugle à 500 caractères. **Chaque entité produit ses propres chunks sémantiques** avec métadonnées : `{ sourceType: 'PROJECT', sourceId, title, content }`. Un projet → 1 à 3 chunks (résumé / rôle & contexte / stack & résultats).

Conséquences directes : les chunks sont **citables** (la réponse renvoie `[PROJECT:coloc-benin]` et l'UI affiche la source cliquable), et la ré-indexation est **incrémentale** — un hash du contenu (`contentHash`) évite de tout ré-embedder à chaque sauvegarde admin.

### D3.5 — Défense contre le prompt injection

Trois couches, à citer telles quelles :
1. **Séparation stricte** : le contexte récupéré est passé dans un bloc délimité, jamais concaténé au prompt système.
2. **Instruction d'ignorance** : le prompt système déclare explicitement que le contenu du bloc de contexte est de la **donnée**, jamais des instructions.
3. **Contrôle de sortie** : la réponse est validée (longueur max, pas de markdown de lien externe) et rendue en texte échappé — aucun `dangerouslySetInnerHTML` sur une sortie de modèle.
4. **Clé serveur uniquement** : l'appel Gemini vit dans une route handler. `GEMINI_API_KEY` n'est **jamais** préfixée `NEXT_PUBLIC_`. Rate limit Redis : 10 messages / heure / visiteur, 30 / heure / IP.

---

## D4 — Temps réel : SSE, pas WebSocket, pas polling naïf

**Choix.** Server-Sent Events via une route handler en streaming, avec détection de changement sur un **compteur Redis**.

**Justification.** WebSocket ne fonctionne pas sur Vercel serverless : il n'y a pas de connexion persistante dans une fonction, il faudrait un service tiers (Pusher, Ably) — hors stack imposée et hors budget temps. Le polling naïf tape Postgres toutes les 3 secondes pour une réponse vide 99 % du temps.

**Mécanisme.** À chaque écriture (nouveau message, nouveau lead, nouvelle réservation), le serveur fait `INCR events:version`. La route SSE boucle : elle lit ce compteur (opération Redis O(1), pas de requête DB), n'émet un événement que s'il a changé, et se ferme proprement à ~50 s — `EventSource` se reconnecte tout seul.

**Si on te challenge.** *« Le compteur Redis est mon détecteur de changement ; Postgres n'est interrogé que quand il y a réellement quelque chose à lire. C'est du polling, mais sur la couche la moins chère de la stack, et l'interface client est un vrai flux SSE. »* — C'est une réponse honnête et techniquement juste. Ne prétends pas avoir du WebSocket.

---

## D5 — Redis : quatre usages distincts, tous justifiés

Le sujet évalue l'infrastructure sur 10 points. Un Redis utilisé uniquement pour le rate limiting, c'est la moitié des points.

1. **Rate limiting** — sliding window `@upstash/ratelimit` sur `/api/auth/login`, `/api/chat`, `/api/contact`, `/api/booking`.
2. **Cache de lecture publique** avec **invalidation par version**. Plutôt que traquer chaque clé, les clés de cache embarquent un numéro de version (`portfolio:v{n}:projects`). Une écriture admin fait `INCR portfolio:version` → tout le cache devient inatteignable d'un coup, sans `SCAN`, sans `DEL` en masse, sans risque d'oubli.
3. **Compteur d'événements** pour le SSE (D4).
4. **Verrou de créneau** anti double-réservation (D6).

*Sessions :* source de vérité en Postgres (révocation immédiate possible), **cache Redis en lecture** avec TTL 60 s pour éviter un aller-retour DB à chaque requête. Ça coche l'usage « sessions » demandé sans sacrifier la révocabilité.

---

## D6 — Booking : double rempart contre la double-réservation

Deux visiteurs cliquent sur le créneau de 14 h à la même seconde. C'est le scénario que l'auditeur va tester.

1. **Verrou Redis** : `SET slot:{ISO} 1 NX EX 30` avant d'écrire. Échec → 409 immédiat, message clair.
2. **Contrainte d'unicité Postgres** sur `Appointment.startsAt` : le dernier rempart, dans une transaction Prisma. Une erreur `P2002` est rattrapée et transformée en 409.

**À l'oral.** *« Le verrou Redis est une optimisation de l'expérience — il évite d'atteindre la base. La contrainte d'unicité est la garantie de correction. Je ne fais jamais reposer une invariant métier sur un cache. »*

Toute la disponibilité est calculée **côté serveur** à partir des `AvailabilityRule` / `AvailabilityException` / `Appointment`. Le client ne propose jamais un créneau que le serveur n'a pas validé, et le serveur revalide à l'écriture.

---

## D7 — Uploads : la sanitisation, c'est le ré-encodage Sharp

Le sujet demande un « scan du contenu ». Voici l'implémentation qui tient.

1. Taille max (5 Mo) vérifiée **avant** lecture complète du corps.
2. Type détecté par **magic bytes** (les premiers octets du fichier), **jamais** par l'extension ni par le `Content-Type` déclaré par le client.
3. Allowlist stricte : `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
4. **Toute image est décodée puis ré-encodée par Sharp** en AVIF + WebP. Un fichier polyglotte (JPEG contenant du JS, PNG avec payload dans un chunk `tEXt`) ne survit pas à un cycle décodage/ré-encodage : le fichier servi n'est plus celui qui a été uploadé.
5. Nom de fichier **généré** (UUID), jamais dérivé de l'entrée utilisateur → pas de path traversal, pas de collision, pas de `.php` déguisé.
6. Servi depuis le domaine Vercel Blob, distinct du domaine applicatif → un fichier malveillant servi ne serait pas same-origin.

---

## D8 — Performance : le motion en CSS, pas en JavaScript

Les animations d'entrée et les révélations au scroll sont faites en **CSS scroll-driven animations** (`animation-timeline: view()`), pas avec Framer Motion ni un `IntersectionObserver` maison.

Trois conséquences mesurables : **0 KB de JS client** pour l'animation, exécution sur le thread compositeur (pas de jank), et aucune hydratation nécessaire → les sections animées restent des **Server Components**.

**À l'oral.** *« Ma direction artistique est fortement animée et pourtant mon bundle client est minimal, parce que le motion ne passe pas par React. Framer Motion m'aurait coûté ~35 KB gzip et forcé `"use client"` sur toutes mes sections. »*

Le JS client est réservé à ce qui est réellement interactif : le chat, les formulaires, le pipeline CRM en drag & drop, le flux SSE.

---

## D9 — Pas de dark mode

**Choix assumé.** Un seul support visuel.

**Justification.** Une direction artistique éditoriale repose sur un rapport encre/papier précis. Un toggle sombre/clair aurait doublé le travail de calibrage typographique pour diluer l'identité — et le sujet demande explicitement une identité **reconnaissable**, pas une interface configurable. Le temps économisé est allé dans la recherche hybride du RAG.

Note-le dans `ARCHITECTURE.md`. Une contrainte assumée et argumentée vaut mieux qu'une fonctionnalité bâclée, et ça anticipe la question avant qu'elle soit posée.

---

## D10 — Analytics sans donnée personnelle

Pas d'IP brute en base. `sessionHash = sha256(ip + userAgent + sel_quotidien)` tronqué à 16 caractères : suffisant pour compter des visiteurs uniques sur 24 h, impossible à remonter à une personne, et le sel tournant empêche le suivi inter-journalier.

C'est 4 lignes de code et un paragraphe dans `SECURITY.md` que personne d'autre n'aura écrit.

---

## Les 3 décisions « à améliorer en +24h » (demandées en soutenance)

Prépare-les maintenant, pas à 23 h 50. Choisis-en trois honnêtes :

1. **Le re-embedding est synchrone à la sauvegarde admin.** Sur un contenu long, ça ajoute ~800 ms à un `POST`. En +24 h : file d'attente (Upstash QStash) et ré-indexation en arrière-plan avec statut visible dans l'admin.
2. **Le SSE est un polling Redis déguisé.** Fonctionnel et peu coûteux, mais la latence perçue est de ~2 s. En +24 h : migration vers un canal pub/sub dédié ou un service temps réel, avec repli automatique sur le mécanisme actuel.
3. **Pas de tests automatisés.** J'ai testé manuellement et documenté les scénarios. En +24 h : tests d'intégration sur les trois invariants critiques (autorisation admin, double-réservation, refus du RAG sous le seuil), en priorité sur la couverture cosmétique.

Ces trois-là sonnent vrai parce qu'elles le sont. Ne va pas dire « j'aurais ajouté le dark mode » — c'est une réponse de candidat qui n'a pas réfléchi à son propre système.
