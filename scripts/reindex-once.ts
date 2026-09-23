// Indexation initiale, one-shot. Appelle reindexAll() directement — même
// chemin de code que le bouton "Réindexer" de /admin/assistant.
import { reindexAll } from "@/lib/rag/index";

async function main() {
  const result = await reindexAll();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
