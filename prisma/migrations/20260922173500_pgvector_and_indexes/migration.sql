CREATE EXTENSION IF NOT EXISTS vector;

-- Index vectoriel. HNSW plafonne à 2000 dimensions pour le type vector :
-- c'est pourquoi les embeddings sont tronqués à 1536 puis normalisés L2
-- côté serveur (norme mesurée du vecteur brut : 0.6922 — cf docs/MESURES.md).
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw_idx
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Branche lexicale de la recherche hybride (RRF). Colonne générée STORED :
-- calculée à l'écriture, jamais à la lecture.
ALTER TABLE knowledge_chunks DROP COLUMN IF EXISTS tsv;
ALTER TABLE knowledge_chunks
  ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(title, '')),   'A') ||
    setweight(to_tsvector('french', coalesce(content, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS knowledge_chunks_tsv_idx
  ON knowledge_chunks USING GIN (tsv);

-- Invariant anti-double-réservation : unicité sur les rendez-vous ACTIFS
-- uniquement. Un rendez-vous annulé libère son créneau.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_active_slot_idx
  ON appointments ("startsAt")
  WHERE status IN ('PENDING', 'CONFIRMED');

-- Analytics : BRIN, adapté à une colonne temporelle strictement croissante
-- et bien plus léger qu'un B-tree.
CREATE INDEX IF NOT EXISTS page_views_created_brin_idx
  ON page_views USING BRIN ("createdAt");
