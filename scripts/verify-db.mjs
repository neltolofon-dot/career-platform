import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  process.loadEnvFile(path.resolve(__dirname, "..", ".env"));
} catch {
  console.log("✗ Impossible de lire .env — le fichier existe-t-il ?");
  process.exit(1);
}

const ok = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => console.log(`✗ ${msg}`);

// Objets créés en SQL manuel (prisma/migrations/*_pgvector_and_indexes) que
// Prisma ne sait pas exprimer dans schema.prisma — donc invisibles à
// `prisma migrate dev`, qui les verrait comme une dérive à supprimer.
// Voir CLAUDE.md § MIGRATIONS et docs/MESURES.md.

async function checkIndex(prisma, indexname, { method, unique, partial }) {
  const rows = await prisma.$queryRaw`
    SELECT am.amname AS method, ix.indisunique AS is_unique, (ix.indpred IS NOT NULL) AS is_partial
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_am am ON am.oid = i.relam
    WHERE i.relname = ${indexname}
  `;

  if (rows.length === 0) {
    fail(`${indexname} — absent de la base.`);
    return false;
  }

  const row = rows[0];
  const problems = [];
  if (row.method !== method) problems.push(`méthode ${row.method} au lieu de ${method}`);
  if (unique !== undefined && row.is_unique !== unique) problems.push(`is_unique=${row.is_unique}`);
  if (partial !== undefined && row.is_partial !== partial) problems.push(`is_partial=${row.is_partial}`);

  if (problems.length > 0) {
    fail(`${indexname} — ${problems.join(", ")}.`);
    return false;
  }

  ok(`${indexname} (USING ${row.method}${unique ? ", UNIQUE" : ""}${partial ? ", PARTIEL" : ""}).`);
  return true;
}

async function checkGeneratedColumn(prisma, table, column) {
  const rows = await prisma.$queryRaw`
    SELECT attgenerated
    FROM pg_attribute
    WHERE attrelid = ${table}::regclass
      AND attname = ${column}
      AND NOT attisdropped
  `;

  if (rows.length === 0) {
    fail(`${table}.${column} — colonne absente.`);
    return false;
  }

  if (rows[0].attgenerated !== "s") {
    fail(`${table}.${column} — pas une colonne GENERATED STORED (attgenerated="${rows[0].attgenerated}").`);
    return false;
  }

  ok(`${table}.${column} — GENERATED ALWAYS ... STORED.`);
  return true;
}

async function main() {
  console.log("Vérification des objets SQL non gérés par Prisma\n");

  if (!process.env.DIRECT_URL) {
    fail("DIRECT_URL est vide — connexion impossible.");
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
  const results = [];

  try {
    results.push(await checkIndex(prisma, "knowledge_chunks_embedding_hnsw_idx", { method: "hnsw" }));
    results.push(await checkIndex(prisma, "knowledge_chunks_tsv_idx", { method: "gin" }));
    results.push(await checkIndex(prisma, "appointments_active_slot_idx", { method: "btree", unique: true, partial: true }));
    results.push(await checkGeneratedColumn(prisma, "knowledge_chunks", "tsv"));
  } finally {
    await prisma.$disconnect();
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length}`);
  process.exitCode = passed === results.length ? 0 : 1;
}

main().catch((err) => {
  fail(`Erreur inattendue : ${err.message}`);
  process.exitCode = 1;
});
