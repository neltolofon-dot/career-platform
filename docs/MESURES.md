# Mesures — Personal Career Platform

Mesures prises en conditions réelles pendant le développement. Alimente
`ARCHITECTURE.md` et `PERFORMANCE.md`.

---

## 2026-09-22 — Norme L2 des embeddings Gemini tronqués

**Contexte.** `gemini-embedding-001`, `outputDimensionality: 1536`,
`taskType: 'RETRIEVAL_DOCUMENT'`, appelé depuis `scripts/check-env.mjs` sur
un texte de test court ("ping de vérification check-env").

**Mesure.** Norme L2 du vecteur brut reçu : **0.6922**.

**Conséquence.** Un vecteur normalisé a par définition une norme de 1. Gemini
ne renormalise pas la sortie après troncature MRL à 1536 dimensions — la
mesure le confirme en conditions réelles, pas seulement dans la documentation
Google. **La normalisation L2 côté serveur est obligatoire, à l'indexation
comme à la requête** (voir D3.1, `docs/01-DECISIONS-ARCHITECTURE.md`).
Sans elle, `<=>` (distance cosinus pgvector) est calculée sur des vecteurs de
norme inégale : le classement RAG se dégrade **sans erreur, sans crash,
sans avertissement**. C'est le piège le plus silencieux du projet — cette
mesure est la preuve à montrer à l'oral si on demande "as-tu vérifié ou
supposé ?".

---

## 2026-09-22 — `prisma migrate dev` propose de supprimer les objets pgvector

**Contexte.** Après application de `20260922173313_init` puis
`20260922173500_pgvector_and_indexes` (extension `vector`, index HNSW,
colonne `tsv` générée + index GIN, index unique partiel anti-double-réservation,
index BRIN), `npx prisma migrate dev` a été lancé pour vérifier l'absence de
dérive (procédure B3 de la session précédente).

**Mesure.** `migrate dev` s'est arrêté sur une invite interactive de nom de
migration — signe qu'il avait détecté une différence entre `schema.prisma`
et l'état réel de la base. Le diff exact, obtenu séparément via
`prisma migrate diff --from-url $DIRECT_URL --to-schema-datamodel prisma/schema.prisma --script` :

```sql
DROP INDEX "knowledge_chunks_embedding_hnsw_idx";
DROP INDEX "knowledge_chunks_tsv_idx";
DROP INDEX "page_views_created_brin_idx";
ALTER TABLE "knowledge_chunks" ALTER COLUMN "tsv" DROP DEFAULT;
```

Le process a été arrêté avant application (aucun nom de migration fourni) ;
les quatre objets ont été vérifiés intacts ensuite via requête directe sur
`pg_indexes`.

**Cause.** `schema.prisma` ne peut pas exprimer : un index avec `USING hnsw`
ou `USING gin`/`USING BRIN`, un index avec clause `WHERE` (partiel), ou une
colonne `GENERATED ALWAYS AS (...) STORED`. Le moteur de diff de Prisma
compare l'état réel de la base à ce qu'il peut représenter depuis
`schema.prisma` seul — tout objet en dehors de ce vocabulaire est traité
comme une dérive à corriger, dans le sens "faire disparaître".

**Conséquence.** `prisma migrate dev` ne doit plus jamais être exécuté tel
quel sur ce projet — il détruirait systématiquement le travail de la
migration manuelle. Procédure obligatoire documentée dans `CLAUDE.md`
(§ MIGRATIONS) : `--create-only`, relecture manuelle du SQL généré,
suppression des lignes `DROP`/`ALTER ... DROP EXPRESSION` touchant
`knowledge_chunks`, `appointments`, `page_views`, puis `migrate deploy`.

`scripts/verify-db.mjs` (`npm run verify:db`) vérifie après coup que les
quatre objets existent toujours et ont la forme attendue (méthode d'index,
unicité, caractère partiel, `attgenerated = 's'` pour la colonne générée) —
c'est le filet de sécurité qui remplace la confiance dans `migrate dev`.
