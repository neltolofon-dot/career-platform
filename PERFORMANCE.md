# Performance — Personal Career Platform

## Index vectoriel

Requête vectorielle de `lib/rag/search.ts` (branche vectorielle de la recherche hybride),
sur `knowledge_chunks` à 30 lignes.

**Plan par défaut — le planificateur choisit un Seq Scan :**

```
Limit  (cost=9.42..9.66 rows=13 width=53) (actual time=0.225..0.253 rows=20.00 loops=1)
  Buffers: shared hit=74
  ->  WindowAgg  (cost=9.42..9.66 rows=13 width=53) (actual time=0.224..0.250 rows=20.00 loops=1)
        Window: w1 AS (ORDER BY ((embedding <=> '[…1536 dims…]'::vector(1536))) ROWS UNBOUNDED PRECEDING)
        Storage: Memory  Maximum Storage: 17kB
        Buffers: shared hit=74
        ->  Sort  (cost=9.40..9.44 rows=13 width=45) (actual time=0.216..0.218 rows=20.00 loops=1)
              Sort Key: ((embedding <=> '[…1536 dims…]'::vector(1536)))
              Sort Method: quicksort  Memory: 26kB
              Buffers: shared hit=74
              ->  Seq Scan on knowledge_chunks  (cost=0.00..9.16 rows=13 width=45) (actual time=0.037..0.172 rows=30.00 loops=1)
                    Filter: (embedding IS NOT NULL)
                    Buffers: shared hit=71
Planning:
  Buffers: shared hit=16 read=1 dirtied=1
Planning Time: 1.264 ms
Execution Time: 1.227 ms
```

**Avec `SET enable_seqscan = off` — preuve que l'index HNSW fonctionne :**

```
Limit  (cost=138.59..168.49 rows=13 width=53) (actual time=0.136..0.256 rows=20.00 loops=1)
  Buffers: shared hit=152
  ->  WindowAgg  (cost=138.59..168.49 rows=13 width=53) (actual time=0.135..0.253 rows=20.00 loops=1)
        Window: w1 AS (ORDER BY (embedding <=> '[…1536 dims…]'::vector(1536)) ROWS UNBOUNDED PRECEDING)
        Storage: Memory  Maximum Storage: 17kB
        Buffers: shared hit=152
        ->  Index Scan using knowledge_chunks_embedding_hnsw_idx on knowledge_chunks  (cost=136.10..168.26 rows=13 width=45) (actual time=0.128..0.239 rows=20.00 loops=1)
              Order By: (embedding <=> '[…1536 dims…]'::vector(1536))
              Filter: (embedding IS NOT NULL)
              Index Searches: 1
              Buffers: shared hit=152
Planning:
  Buffers: shared hit=1
Planning Time: 0.136 ms
Execution Time: 0.295 ms
```

**Conclusion.** L'index HNSW `knowledge_chunks_embedding_hnsw_idx` est créé et fonctionnel. À
30 chunks, le planificateur Postgres choisit un Seq Scan (coût 9.42) plutôt que l'Index Scan
(coût 138.59) : à ce volume, parcourir la table est objectivement moins cher que traverser un
graphe HNSW. La vérification par `SET enable_seqscan = off` confirme que l'index est bien
utilisable et retourne les mêmes résultats. Le basculement se fera naturellement à mesure que
la base de connaissances grossit.
