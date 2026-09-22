# Personal Career Platform — contexte projet

Challenge technique 24 h. Application SaaS personnelle full-stack, déployée sur Vercel,
repo GitHub public, auditée par un jury. Le sujet complet et les décisions détaillées
sont dans `docs/`.

**Stack imposée, non négociable :** Next.js 16 App Router · TypeScript strict · Tailwind v4 ·
Prisma · PostgreSQL (Neon) · Redis (Upstash) · Zod · Gemini (chat + embeddings) ·
Sharp + next/image · Auth avec RBAC · Vercel · GitHub.

---

## Fichiers de référence — à lire avant d'agir

| Fichier | Quand le lire |
|---|---|
| `docs/01-DECISIONS-ARCHITECTURE.md` | Avant toute décision technique. Les décisions D1 à D10 sont **verrouillées**. |
| `docs/02-schema.prisma` | Source de vérité du modèle de données. |
| `docs/03-DESIGN-SYSTEM.md` | Avant toute UI. **Normatif.** |
| `docs/04-tokens.css` | Source de vérité visuelle. |
| `docs/05-PLAN-24H.md` | Découpage horaire et prompts de délégation. |
| `docs/06-COUVERTURE-BAREME.md` | Checklist finale contre le barème. |

Si une de ces décisions te semble discutable, **dis-le avant de coder** — ne la contourne pas
silencieusement.

---

## Règles absolues

1. **Server Components par défaut.** `"use client"` uniquement si état, effet ou écouteur
   d'événement est indispensable — et justifie-le en commentaire.
2. **Aucun composant au-dessus de 150 lignes.** Découpe.
3. **Toute entrée utilisateur est validée par Zod côté serveur.** Toujours.
4. **`requireAdmin()` en première ligne** de chaque route `/api/admin/*` et de chaque Server
   Component sous `/admin`. Le middleware n'est PAS une frontière de sécurité (CVE-2026-64642).
5. **Toute liste est paginée côté serveur.**
6. **Aucune valeur brute** de couleur, taille ou durée dans un composant : uniquement les
   tokens de `app/globals.css`.
7. **Aucune animation en JavaScript.** Le motion est en CSS (voir §Motion).
8. **Aucun `dangerouslySetInnerHTML`** sur du contenu utilisateur ou une sortie de modèle.
9. **Erreurs :** message générique côté client, détail dans les logs serveur. Jamais de
   stack trace exposée.
10. **Aucun secret dans le dépôt.** `.env` jamais versionné, jamais de `NEXT_PUBLIC_` sur
    une clé sensible.
11. **Aucun `any`, aucun `@ts-ignore`.**

---

## Décisions verrouillées (résumé — détail dans `docs/01`)

- **D1** — Autorisation dans `requireAdmin()`, au contact de la donnée. Le middleware ne fait
  que les headers et la redirection UX.
- **D2** — Auth maison : sessions opaques en base, **hash SHA-256 du token stocké** (pas le
  token), cookie `__Host-` + `httpOnly` + `SameSite=Lax` + `Secure`, Argon2id via
  `@node-rs/argon2`. Aucune route d'inscription. Rate limit double fenêtre (IP + compte).
- **D3** — RAG : `gemini-embedding-001` en **1536 dimensions** (HNSW plafonne à 2000),
  **normalisation L2 obligatoire** après troncature, stockage `vector(1536)`, index HNSW
  cosine. Recherche **hybride** vectoriel + `tsvector` français fusionnée par **RRF**.
  Chunking **structurel** par entité (jamais par nombre de caractères).
  **Refus déterministe sous le seuil de score, AVANT l'appel à Gemini.**
- **D4** — Temps réel : **SSE** sur compteur Redis (`INCR events:version`). Pas de WebSocket
  (impossible en serverless Vercel), pas de polling sur Postgres.
- **D5** — Redis : rate limiting · cache versionné (`INCR portfolio:version` invalide tout) ·
  compteur d'événements SSE · verrou de créneau.
- **D6** — Booking : **verrou Redis + contrainte d'unicité Postgres** sur `startsAt`.
  `P2002` → HTTP 409.
- **D7** — Uploads : magic bytes (jamais l'extension), allowlist, **ré-encodage Sharp
  systématique** (c'est la sanitisation), nom de fichier généré.
- **D8** — Motion en CSS scroll-driven : 0 KB de JS, les sections restent Server Components.
- **D9** — **Pas de dark mode.** Décision assumée, documentée.
- **D10** — Analytics sans IP brute : `sha256(ip + UA + sel_du_jour)` tronqué.

---

## Direction artistique — « Dossier technique »

Encre sur papier, éditorial, typographique. Détail complet dans `docs/03-DESIGN-SYSTEM.md`.

**Palette — 5 couleurs, pas 6 :**
`--paper #FAF8F3` · `--surface #F2EEE5` · `--ink #14130F` · `--ink-muted #6B6760` ·
`--rule #DCD7CC` · `--vermilion #C2410C`

Le vermillon est de l'encre de correction : **une seule occurrence visible par écran.**

**Typographie — 3 familles, 3 rôles disjoints :**
Fraunces (display, `font-variation-settings: "SOFT" 0, "WONK" 1`) · Inter (corps) ·
Geist Mono (tout chiffre, date, label, identifiant).
Corps de texte plafonné à **68 caractères** par ligne.

**Structure :** chaque section a une colonne de métadonnées en marge (mono, 11px, sticky)
portant son numéro à deux chiffres, et un **ancrage asymétrique** dans la grille de 12
colonnes. Le contenu ne se centre jamais. `SectionFrame.tsx` encode cette grille et est
réutilisé par les six sections.

**Motion — 4 primitives, une seule courbe (`cubic-bezier(0.2, 0.7, 0.2, 1)`) :**
révélation typographique masquée · View Transitions · entrée scroll-driven en CSS pur ·
réaction d'état à 120 ms. `prefers-reduced-motion` respecté partout.

---

## Interdits — aucune exception

```
✗ border-radius > 2px
✗ box-shadow                    → filet 1px --rule à la place
✗ gradient, glassmorphism, backdrop-filter, blobs
✗ emoji dans l'interface
✗ hero « Hello, I'm … »
✗ section entièrement composée de cartes   → l'index des travaux est une TABLE
✗ barre de progression ou pourcentage de compétence
✗ bulle de chat flottante en bas à droite  → le chatbot est une SECTION de la page
✗ dark mode, toggle de thème
✗ Framer Motion, GSAP, toute lib d'animation JS
✗ shadcn/ui, Radix, toute lib de composants préfabriqués
✗ plus d'une couleur d'accent par écran
✗ texte centré sur plus de deux lignes
✗ placeholder à la place d'un label
✗ scroll hijacking, curseur personnalisé, effet machine à écrire
```

```
✓ filets 1px comme unique séparateur
✓ mono pour tout chiffre, date, label, identifiant
✓ chaque section porte un numéro à deux chiffres en marge
✓ :focus-visible distinct partout (contour vermillon 2px, offset 2px)
✓ tout composant UI sous 150 lignes
```

---

## Pièges connus — vérifiés, ne les redécouvre pas

- **Neon :** `DATABASE_URL` = URL **poolée** (runtime), `DIRECT_URL` = URL **directe**
  (migrations). Les confondre fait échouer `prisma migrate` de façon illisible.
- **Gemini embeddings :** la sortie tronquée à 1536 n'est **pas normalisée** par Gemini.
  Sans normalisation L2 manuelle, la distance cosinus est fausse et le RAG classe mal
  **sans jamais planter**.
- **taskType :** `RETRIEVAL_DOCUMENT` pour les chunks, `RETRIEVAL_QUERY` pour la question.
  Les inverser dégrade tout silencieusement.
- **pgvector :** sans index HNSW, `EXPLAIN ANALYZE` montre un `Seq Scan`. Vérifie-le.
- **Prisma + pgvector :** le champ `embedding` est `Unsupported("vector(1536)")`, donc
  invisible au client généré. Lecture et écriture via `$queryRaw` avec cast `::vector`.
- **Next.js :** épingler la dernière 16.3.x **patchée** (release de sécurité 16.3.6 annoncée
  le 21/09/2026). Vérifier nextjs.org/blog.
- **Redis — nommage des variables :** `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`,
  pas `REDIS_URL` / `REDIS_TOKEN`. Ce sont les noms injectés automatiquement par
  l'intégration Vercel-Upstash, et `Redis.fromEnv()` (`@upstash/redis`) les lit sans
  configuration. Un seul nommage dans tout le code, `.env`, `.env.example` et
  `scripts/check-env.mjs` — pas de fallback entre les deux conventions.

---

## ⚠️ MIGRATIONS

**`npx prisma migrate dev` est INTERDIT sur ce projet.**

Prisma ne sait pas exprimer les index partiels, les index HNSW/GIN/BRIN ni les colonnes
GENERATED. Il les voit comme une dérive et propose de les DROP à chaque exécution. Vérifié
en pratique le 22/09/2026 : `migrate dev` proposait de supprimer les trois index de
`prisma/migrations/*_pgvector_and_indexes` et de retirer la génération de `knowledge_chunks.tsv`.

**Procédure obligatoire pour toute évolution du schéma :**

```bash
npx prisma migrate dev --create-only --name <nom>
# OUVRIR le migration.sql généré et SUPPRIMER toute ligne
# DROP INDEX / ALTER COLUMN ... DROP EXPRESSION touchant :
# knowledge_chunks, appointments, page_views
npx prisma migrate deploy
npm run verify:db   # doit afficher 4/4
```

Détail technique complet : `docs/MESURES.md`.

---

## Commandes de vérification — à rejouer avant chaque livraison

```bash
curl -i https://<url>/api/admin/projects        # attendu : 401, pas une redirection
curl -i https://<url>/admin                     # attendu : 302 vers /login
git log -p | grep -iE "(api[_-]?key|secret|postgres://)"   # attendu : vide
grep -rn "NEXT_PUBLIC" . --include="*.ts*"      # aucune clé sensible
npx lighthouse https://<url> --view             # viser ≥ 95 perf / 100 a11y
```

---

## Style de collaboration

Sois direct. Si une instruction contient une erreur, une faille de sécurité ou une mauvaise
décision technique, **dis-le avant d'exécuter**, même sans qu'on te le demande. Pas de
validation réflexe.

Ne produis ni README décoratif, ni commentaires évidents. Commente uniquement les décisions
non triviales — celles qu'il faudra défendre à l'oral.

Le développeur doit pouvoir expliquer chaque fichier en 30 secondes. Si tu produis quelque
chose d'opaque, explique-le en même temps.
