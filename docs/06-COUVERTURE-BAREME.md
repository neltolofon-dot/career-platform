# Couverture du barème — contrôle ligne par ligne

Relu contre le sujet. À rejouer à H22 comme checklist finale.

---

## Architecture globale & modules fonctionnels — 20 pts

| Exigence | Réponse | État |
|---|---|---|
| CMS personnel `/admin` complet | 13 entrées de navigation, CRUD sur 5 entités, tout éditable sans toucher au code | ✅ couvert |
| Système de réservation | Services + règles + exceptions + rendez-vous, double rempart anti-collision | ✅ couvert |
| Mini-CRM pipeline | Contact pivot + Lead + LeadNote + LeadEvent auditable, 6 étapes | ✅ couvert |
| Chatbot RAG | Chunking structurel, hybride RRF, refus codé, citations affichées | ✅ couvert |
| Messagerie + notifications | Conversation/Message/Notification, SSE sur compteur Redis | ✅ couvert |
| Cohérence d'ensemble | Contact est le pivot unique des 3 modules relationnels — c'est l'argument d'architecture | ✅ couvert |

---

## Backend / API / base de données — 15 pts

| Exigence | Réponse | État |
|---|---|---|
| Schéma propre | 23 modèles, 10 enums, relations explicites, `onDelete` posé partout | ✅ |
| Transactions multi-tables | Contact+Conversation+Lead+Notification ; Lead stage + LeadEvent ; Appointment + CalendarEvent | ✅ |
| Pagination | Toutes les listes admin et publiques, côté serveur | ✅ |
| Validation Zod | Un fichier de schémas par domaine, appelé avant tout usage | ✅ |
| Requêtes paramétrées | Prisma partout ; les seuls `$queryRaw` sont ceux de pgvector, en paramétré | ✅ |
| Index | Composites alignés sur les requêtes réelles, pas décoratifs — cf. commentaires du schéma | ✅ |
| Méthodes HTTP explicites | Handlers nommés `GET`/`POST`/`PATCH`/`DELETE` ; tout le reste → 405 | ⚠️ à vérifier |
| Limite de taille de payload | À poser explicitement dans les route handlers mutatives | ⚠️ **à faire, souvent oublié** |

---

## Chatbot IA — RAG — 15 pts

| Exigence | Réponse | État |
|---|---|---|
| Vraie base de connaissances | Table `knowledge_chunks`, alimentée depuis les entités CMS | ✅ |
| Chunking | Structurel par entité, avec métadonnées de source | ✅ |
| Embeddings | `gemini-embedding-001`, 1536 dims, normalisation L2, taskType correct | ✅ |
| Recherche vectorielle | HNSW cosine + branche lexicale française, fusion RRF | ✅ dépasse l'attendu |
| Clé strictement serveur | Route handler uniquement, jamais `NEXT_PUBLIC_` | ✅ |
| Prompt système verrouillé | Contexte isolé en bloc délimité, déclaré comme donnée | ✅ |
| Jamais d'invention | Refus **avant** l'appel au modèle, sous le seuil de score | ✅ dépasse l'attendu |
| Validation + rate limit | Zod + double fenêtre Redis sur `/api/chat` | ✅ |
| Traçabilité | `citations` + `refused` persistés sur chaque `ChatMessage` | ✅ bonus |

---

## Design / UX / direction artistique — 15 pts

| Exigence | Réponse | État |
|---|---|---|
| Identité forte et reconnaissable | DA éditoriale encre/papier, Fraunces en mode `wonk`, colonne de métadonnées | ✅ |
| Pas d'enchaînement générique de blocs | 6 mouvements numérotés, ancrage asymétrique par section | ✅ |
| Pas de page uniquement en cartes | L'index des travaux est une **table** typographique | ✅ |
| Anti-patterns évités | Liste d'interdits explicite, §8 du design system | ✅ |
| Responsive | Grille qui s'effondre proprement, table → blocs à filets | ✅ |
| Accessibilité | `focus-visible` unique, `prefers-reduced-motion`, labels réels, contrastes AA vérifiés | ✅ |
| Animations justifiées | 4 primitives, une seule courbe, aucune boucle infinie | ✅ |

---

## Sécurité — 10 pts

| Exigence | Réponse | État |
|---|---|---|
| Auth robuste | Argon2id, sessions opaques, hash du token en base | ✅ |
| RBAC, aucune route `/admin` sans vérif serveur | `requireAdmin()` au contact de la donnée, pas dans le middleware | ✅ argument fort |
| Anti brute force | Double fenêtre Redis IP + compte, réponses indistinguables | ✅ |
| Zod systématique | ✅ | ✅ |
| Pas de concaténation SQL | ✅ | ✅ |
| Transactions | ✅ | ✅ |
| Pagination | ✅ | ✅ |
| Payload + méthodes | ⚠️ voir ci-dessus | ⚠️ |
| Erreurs sans stack trace | Message générique client, détail en log serveur | ✅ |
| XSS | Échappement React par défaut, aucun `dangerouslySetInnerHTML` sur contenu utilisateur ou modèle | ✅ |
| CSRF | Server Actions + vérification d'origine sur les route handlers mutatives, cookie `SameSite=Lax` | ✅ |
| Upload sécurisé | Magic bytes + allowlist + ré-encodage Sharp + nom généré + domaine distinct | ✅ |
| Headers HTTP | CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS | ✅ |
| Secrets | `.env` jamais versionné, grep sur l'historique git à H22 | ✅ |

---

## Infrastructure — 10 pts ⚠️ **le trou classique : logs et monitoring**

Le sujet évalue « Redis, stockage objet, variables d'environnement, déploiement Vercel,
**logs, monitoring** », et la soutenance demande explicitement « comment le site est
déployé et surveillé ». La plupart des candidats n'auront rien à montrer sur ce point.
Ça se règle en **45 minutes** à H18.

```
□ lib/logger.ts — log structuré JSON : { requestId, route, method, status,
  durationMs, userId? }. Les logs Vercel deviennent filtrables et requêtables.
  Aucune donnée personnelle loguée (pas d'email, pas d'IP brute).

□ instrumentation.ts — hook onRequestError de Next.js : capture centralisée des
  erreurs serveur avec le requestId. C'est la fonctionnalité native, ça ne coûte
  rien et ça montre que tu connais le framework.

□ GET /api/health — teste Postgres (SELECT 1), Redis (PING) et la présence des
  variables Gemini. Retourne 200 ou 503 avec le détail par dépendance.
  Tu ouvres cette URL pendant la soutenance : c'est la réponse à
  « comment tu surveilles ».

□ @vercel/analytics + @vercel/speed-insights — Core Web Vitals sur le trafic
  réel, pas seulement un Lighthouse de labo. 2 lignes dans layout.tsx.

□ vercel.json → cron quotidien : purge des sessions expirées et des PageView
  de plus de 90 jours. Montre que tu penses au cycle de vie de la donnée.
```

| Exigence | Réponse | État |
|---|---|---|
| Redis | 4 usages distincts et justifiés | ✅ |
| Stockage objet | Vercel Blob | ✅ |
| Variables d'environnement | `.env.example` complet, aucune valeur | ✅ |
| Déploiement Vercel | Dès H2, en continu | ✅ |
| Logs | ⚠️ bloc ci-dessus | ⚠️ **à faire** |
| Monitoring | ⚠️ bloc ci-dessus | ⚠️ **à faire** |

---

## Performance — 10 pts

| Exigence | Réponse | État |
|---|---|---|
| Sharp / WebP / AVIF | Pipeline build-time, 3 largeurs, LQIP en base | ✅ |
| `next/image` avec `sizes` | Obligatoire, vérifié à H20 | ✅ |
| Server Components | Par défaut ; le motion en CSS évite d'hydrater les sections | ✅ argument fort |
| Lazy loading | `priority` sur la seule image du premier écran, le reste en lazy | ✅ |
| Optimisation des polices | `next/font`, auto-hébergement, `display: swap`, préchargement | ✅ |
| Code splitting | Par route, plus `dynamic()` sur le board CRM et l'éditeur | ✅ |
| Caching Redis | Cache-aside versionné | ✅ |
| Index PostgreSQL | Composites + GIN + HNSW + BRIN, avec `EXPLAIN ANALYZE` à l'appui | ✅ |
| Pagination | ✅ | ✅ |
| Lighthouse | Audit à H20, capture dans `PERFORMANCE.md` | ✅ |

---

## Qualité du code & documentation — 5 pts

| Exigence | Réponse | État |
|---|---|---|
| README.md | Installation, variables, seed, parcours de démo en 5 étapes | ✅ |
| ARCHITECTURE.md | Sections exactement telles qu'imposées par le sujet, dérivées de `01-DECISIONS` | ✅ |
| DATABASE.md | Schéma commenté + justification du pivot Contact + stratégie d'index | ✅ |
| SECURITY.md | Menace par menace, avec les commandes `curl` de vérification reproductibles | ✅ |
| PERFORMANCE.md | Lighthouse + `EXPLAIN ANALYZE` + stratégie de cache | ✅ |
| .env.example | ✅ | ✅ |
| TypeScript strict | Aucun `any`, aucun `@ts-ignore` | ✅ |
| Composants < 150 lignes | Règle dans le préambule de délégation | ✅ |

---

## Les 4 restes à faire identifiés

Rien de lourd, mais ce sont exactement les points qu'un auditeur attentif va chercher :

1. **Limite de taille de payload** sur les route handlers mutatives — explicitement demandé
   dans le sujet, presque toujours oublié. ~15 lignes.
2. **Méthodes HTTP non autorisées → 405** explicite plutôt que le comportement par défaut.
   ~10 lignes.
3. **Logging structuré + `instrumentation.ts`** — 30 min, et c'est la moitié de ta réponse
   sur l'infrastructure à l'oral.
4. **`/api/health`** — 20 min, et tu as quelque chose à *montrer* quand on te demande
   comment tu surveilles ton application.

Ces quatre-là représentent environ **1 h 15 de travail** et touchent trois axes du barème.
Meilleur rapport points/heure de tout le projet. Cale-les à H18–H19.
