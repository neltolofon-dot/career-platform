import { chromium } from "playwright";

// Remplace le test 4 de docs/07-AUTH-CODE.md, qui attendait un HTTP 429 —
// loginAction est une Server Action : Next.js encapsule sa réponse dans un
// payload RSC en 200, le blocage n'est jamais observable au code de statut.
// Ce script vérifie la seule chose qui compte réellement : le message
// affiché à l'utilisateur, via un vrai navigateur.
//
// Compte de test dédié (pas ADMIN_EMAIL) : loginRateLimitByAccount s'applique
// avant toute recherche en base, donc un email inexistant suffit à prouver
// le mécanisme — et ça évite de bloquer le vrai compte admin à chaque run.
// Unique à chaque exécution : la clé Redis du compte persiste 15 min, un
// email fixe ferait hériter l'état d'un run précédent.
const TEST_EMAIL = `ratelimit-verification+${Date.now()}@career-platform.invalid`;
const BASE_URL = process.argv[2] ?? process.env.TEST_URL ?? "https://career-platform-pied.vercel.app";
const ATTEMPTS = 6;
const BLOCK_MESSAGE = "Trop de tentatives";

// .field__error, pas [role="alert"] : Next.js pose aussi role="alert" sur son
// route announcer (#__next-route-announcer__), ce qui casse le sélecteur en
// mode strict Playwright (deux éléments correspondent).
async function attemptLogin(page, i) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.locator("#email").fill(TEST_EMAIL);
  await page.locator("#password").fill(`wrong-password-${i}`);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForSelector(".field__error", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  return page.locator(".field__error").innerText().catch(() => "");
}

async function main() {
  console.log(`Cible : ${BASE_URL}`);
  console.log(`Compte de test : ${TEST_EMAIL}\n`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const results = [];

  for (let i = 1; i <= ATTEMPTS; i++) {
    const message = await attemptLogin(page, i);
    const blocked = message.includes(BLOCK_MESSAGE);
    results.push({ attempt: i, message, blocked });
    console.log(`Tentative ${i}/${ATTEMPTS} — ${blocked ? "BLOQUÉ" : "refusé"} — "${message}"`);
  }

  await browser.close();

  // loginRateLimitByAccount : slidingWindow(5, '15 m') — les 5 premières
  // tentatives doivent passer la validation (et échouer sur les identifiants),
  // la 6e doit être bloquée par le rate limit.
  const firstFive = results.slice(0, 5);
  const sixth = results[5];

  const firstFiveOk = firstFive.every((r) => !r.blocked);
  const sixthBlocked = sixth.blocked;

  console.log("");
  if (firstFiveOk && sixthBlocked) {
    console.log("OK — tentatives 1 à 5 non bloquées, tentative 6 bloquée par le rate limit.");
    process.exitCode = 0;
  } else {
    console.log("ÉCHEC — le rate limit ne se déclenche pas exactement à la 6e tentative.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Erreur inattendue :", err.message);
  process.exitCode = 1;
});
