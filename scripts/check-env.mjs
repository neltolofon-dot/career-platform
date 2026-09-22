import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { Redis } from "@upstash/redis";
import { GoogleGenAI } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");

try {
  process.loadEnvFile(envPath);
} catch {
  console.log(`✗ Impossible de lire ${envPath} — le fichier existe-t-il ?`);
  process.exit(1);
}

const ok = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => console.log(`✗ ${msg}`);
const info = (msg) => console.log(`  ℹ ${msg}`);

// Traduit les erreurs réseau/API les plus courantes en cause probable,
// plutôt que de laisser fuiter une stack trace (règle CLAUDE.md #9).
function explainError(err, service) {
  const msg = String(err?.message ?? err);

  if (/Can't reach database server/i.test(msg)) {
    return "Serveur Postgres injoignable — vérifie l'URL Neon, ou que le projet Neon n'est pas en auto-pause (inactivité prolongée).";
  }
  if (/authentication failed/i.test(msg)) {
    return "Identifiants invalides dans DATABASE_URL — vérifie l'utilisateur et le mot de passe.";
  }
  if (/self.?signed certificate|SSL/i.test(msg)) {
    return "Problème SSL — vérifie que sslmode=require est bien dans DATABASE_URL.";
  }
  if (/ENOTFOUND|EAI_AGAIN/.test(msg)) {
    return "Nom d'hôte introuvable — vérifie l'URL dans .env.";
  }
  if (/ECONNREFUSED/.test(msg)) {
    return "Connexion refusée — le service est injoignable (mauvais port ou service à l'arrêt).";
  }
  if (/ETIMEDOUT|timeout/i.test(msg)) {
    return "Délai dépassé — le service ne répond pas.";
  }
  if (/401|unauthorized|API key not valid|invalid.?api.?key/i.test(msg)) {
    const key = service === "gemini" ? "GEMINI_API_KEY" : service === "redis" ? "REDIS_TOKEN" : "la clé API";
    return `${key} invalide ou expirée.`;
  }
  if (/403|forbidden|permission/i.test(msg)) {
    return "Accès refusé — la clé n'a pas les permissions nécessaires.";
  }

  return msg.split("\n")[0];
}

function checkNeonUrls() {
  console.log("1. Format des URLs Neon");
  const dbUrl = process.env.DATABASE_URL ?? "";
  const directUrl = process.env.DIRECT_URL ?? "";

  if (!dbUrl || !directUrl) {
    fail("DATABASE_URL ou DIRECT_URL est vide — renseigne les deux dans .env.");
    return false;
  }

  let allOk = true;

  if (!dbUrl.startsWith("postgresql://")) {
    fail("DATABASE_URL ne commence pas par postgresql://.");
    allOk = false;
  }
  if (!directUrl.startsWith("postgresql://")) {
    fail("DIRECT_URL ne commence pas par postgresql://.");
    allOk = false;
  }

  const dbHasPooler = dbUrl.includes("-pooler");
  const directHasPooler = directUrl.includes("-pooler");

  if (dbHasPooler && !directHasPooler) {
    ok("DATABASE_URL est l'URL poolée (-pooler), DIRECT_URL est l'URL directe.");
  } else if (!dbHasPooler && directHasPooler) {
    fail(
      "DATABASE_URL et DIRECT_URL sont INVERSÉES : DATABASE_URL doit être l'URL poolée (-pooler, pour le runtime) et DIRECT_URL l'URL directe (pour les migrations). En l'état, `prisma migrate` échouera de façon illisible."
    );
    allOk = false;
  } else if (dbHasPooler && directHasPooler) {
    fail('DIRECT_URL contient "-pooler" — elle doit pointer vers la connexion directe Neon (sans -pooler).');
    allOk = false;
  } else {
    fail('DATABASE_URL ne contient pas "-pooler" — elle doit être l\'URL POOLÉE de Neon (runtime).');
    allOk = false;
  }

  return allOk;
}

async function checkPostgres() {
  console.log("\n2. Postgres (DATABASE_URL)");
  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL est vide — connexion impossible.");
    return false;
  }

  let prisma;
  try {
    prisma = new PrismaClient();
    const versionRows = await prisma.$queryRaw`SELECT version()`;
    const version = versionRows?.[0]?.version ?? "inconnue";
    ok(`Connexion Postgres OK — ${version.split(",")[0]}`);

    const ext = await prisma.$queryRaw`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
    if (ext.length === 0) {
      fail("L'extension pgvector n'est pas activée sur cette base. Exécute `CREATE EXTENSION vector;` sur Neon avant toute migration.");
      return false;
    }
    ok("Extension pgvector activée.");
    return true;
  } catch (err) {
    fail(explainError(err, "postgres"));
    return false;
  } finally {
    await prisma?.$disconnect();
  }
}

async function checkRedis() {
  console.log("\n3. Redis (Upstash)");
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    fail("UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN sont vides.");
    return false;
  }

  if (url.startsWith("rediss://")) {
    fail(
      "L'URL commence par rediss:// (connexion Redis native) — @upstash/redis attend l'URL REST en https://. Utilise \"UPSTASH_REDIS_REST_URL\" depuis la console Upstash, pas l'URL de connexion Redis standard."
    );
    return false;
  }
  if (!url.startsWith("https://")) {
    fail(`L'URL ne commence pas par https:// (valeur actuelle : ${url.slice(0, 24)}...).`);
    return false;
  }

  try {
    const redis = new Redis({ url, token });
    const key = `career-platform:check-env:${Date.now()}`;
    await redis.set(key, "ok");
    const value = await redis.get(key);
    await redis.del(key);

    if (value !== "ok") {
      fail("Le SET/GET de test a renvoyé une valeur inattendue.");
      return false;
    }
    ok("SET/GET/DEL de test réussi sur Upstash Redis.");
    return true;
  } catch (err) {
    fail(explainError(err, "redis"));
    return false;
  }
}

async function checkGemini() {
  console.log("\n4. Gemini embeddings");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    fail("GEMINI_API_KEY est vide.");
    return false;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: ["ping de vérification check-env"],
      config: {
        outputDimensionality: 1536,
        taskType: "RETRIEVAL_DOCUMENT",
      },
    });

    const values = response.embeddings?.[0]?.values ?? [];
    if (values.length !== 1536) {
      fail(`Le vecteur reçu contient ${values.length} valeurs au lieu de 1536.`);
      return false;
    }

    const norm = Math.hypot(...values);
    ok(`Embedding reçu — 1536 dimensions. Norme L2 = ${norm.toFixed(4)}.`);
    if (Math.abs(norm - 1) > 0.01) {
      info(
        "Norme ≠ 1 : c'est attendu, Gemini ne normalise pas les sorties tronquées à 1536 dimensions. La normalisation L2 manuelle côté serveur reste obligatoire avant stockage/comparaison (D3.1)."
      );
    }
    return true;
  } catch (err) {
    fail(explainError(err, "gemini"));
    return false;
  }
}

function checkSessionSecret() {
  console.log("\n5. SESSION_SECRET");
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) {
    fail(`SESSION_SECRET fait ${secret.length} caractères — il en faut au moins 32. Génère-le avec : openssl rand -base64 32`);
    return false;
  }
  ok(`SESSION_SECRET fait ${secret.length} caractères.`);
  return true;
}

async function main() {
  console.log("Vérification de l'environnement — Personal Career Platform\n");

  const results = [checkNeonUrls(), await checkPostgres(), await checkRedis(), await checkGemini(), checkSessionSecret()];

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/5 vérifications passées`);
  process.exitCode = passed === results.length ? 0 : 1;
}

main().catch((err) => {
  fail(`Erreur inattendue : ${explainError(err)}`);
  process.exitCode = 1;
});
