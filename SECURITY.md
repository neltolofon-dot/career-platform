# Security

## Vérifications d'authentification et de contrôle d'accès

Rejouées le 2026-09-22 contre `https://career-platform-pied.vercel.app`, après déploiement
du RBAC (D1/D2, `docs/07-AUTH-CODE.md`).

### 1. API admin sans cookie → 401, jamais une redirection

```
$ curl -i https://career-platform-pied.vercel.app/api/admin/ping

HTTP/1.1 401 Unauthorized
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.public.blob.vercel-storage.com; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Content-Type: application/json
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY

{"error":"Unauthorized"}
```

### 2. Page admin sans cookie → redirection vers /login

```
$ curl -i https://career-platform-pied.vercel.app/admin

HTTP/1.1 307 Temporary Redirect
Location: /login
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.public.blob.vercel-storage.com; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY

Redirecting...
```

### 3. Méthode non autorisée → 405

```
$ curl -i -X POST https://career-platform-pied.vercel.app/api/admin/ping

HTTP/1.1 405 Method Not Allowed
Allow: GET
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.public.blob.vercel-storage.com; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

### 4. Rate limit du login — pas un test curl, et c'est volontaire

`docs/07-AUTH-CODE.md` demandait à l'origine un test curl attendant un code
HTTP 429 après plusieurs échecs. **Ce test ne peut pas fonctionner** :
`loginAction` est une Server Action React. Next.js encapsule systématiquement
sa réponse dans un payload RSC renvoyé en **200**, que l'action réussisse ou
échoue — le statut HTTP ne porte jamais l'information métier. Un
`curl -w "%{http_code}"` verra donc toujours 200, qu'il y ait blocage ou non.
**Ce n'est pas un défaut d'implémentation, c'est le comportement du
framework** pour toute Server Action invoquée par un formulaire.

La vérification réelle porte sur le message affiché à l'écran, via
`scripts/test-ratelimit.mjs` (`npm run test:ratelimit`) : un vrai navigateur
headless (Playwright) tente 6 connexions avec un email de test dédié
(jamais `ADMIN_EMAIL`, pour ne jamais bloquer le vrai compte), et vérifie que
les tentatives 1 à 5 échouent sur les identifiants tandis que la 6e est
bloquée par `loginRateLimitByAccount` (`slidingWindow(5, '15 m')`).

Exécuté contre un environnement `dev` propre (clés Redis jamais utilisées
auparavant — voir Incident 002 ci-dessous sur la contamination inter-environnements) :

```
$ npm run test:ratelimit

Cible : http://localhost:3000
Compte de test : ratelimit-verification+1790109404286@career-platform.invalid

Tentative 1/6 — refusé — "Identifiants invalides."
Tentative 2/6 — refusé — "Identifiants invalides."
Tentative 3/6 — refusé — "Identifiants invalides."
Tentative 4/6 — refusé — "Identifiants invalides."
Tentative 5/6 — refusé — "Identifiants invalides."
Tentative 6/6 — BLOQUÉ — "Trop de tentatives. Réessayez dans quelques minutes."

OK — tentatives 1 à 5 non bloquées, tentative 6 bloquée par le rate limit.
```

**Note.** Les routes API publiques *mutatives* à venir (`/api/contact`,
`/api/booking`, `/api/chat`) ne sont **pas** des Server Actions — ce sont des
route handlers classiques. Elles renverront de vrais codes **429** observables
au curl, testables par un auditeur externe sans navigateur. La distinction
n'est pas cosmétique : un formulaire de login progressive-enhancement doit
rester utilisable sans JS (d'où la Server Action) ; une API publique appelée
par `fetch()` n'a pas cette contrainte et expose son état dans le code HTTP,
comme attendu par tout client HTTP standard.

### 5. En-têtes de sécurité présents

```
$ curl -sI https://career-platform-pied.vercel.app/ | grep -iE "content-security|x-content-type|referrer|permissions|strict-transport"

Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.public.blob.vercel-storage.com; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
```

### 6. Cookie de session et hash en base — preuve de la fiche 1.1

Connexion réelle effectuée en production (Playwright) avec `ADMIN_EMAIL` /
`ADMIN_PASSWORD`. Cookie lu directement depuis le contexte du navigateur :

```json
{
  "name": "__Host-session",
  "path": "/",
  "httpOnly": true,
  "secure": true,
  "sameSite": "Lax"
}
```

Les cinq attributs attendus sont confirmés : préfixe `__Host-`, `HttpOnly`,
`Secure`, `SameSite=Lax`, `Path=/`.

Preuve que le token brut n'existe pas en base — recherche directe par sa
valeur exacte, puis par son SHA-256 :

```
Hash attendu (sha256 du token du cookie) : 0a3e80d05f360b0b5872ff5b627d98e42af0007db983535d177722869f5252ed
Session trouvée par tokenHash = sha256(token) ? OUI
Session trouvée par tokenHash = token BRUT ?     NON (attendu)
tokenHash stocké en base : 0a3e80d05f360b0b5872ff5b627d98e42af0007db983535d177722869f5252ed
Correspond exactement au SHA-256 calculé ? true
```

Un dump de la base ne contient que ce hash — inutilisable pour reconstruire
le cookie et se faire passer pour l'admin.

---

## Incident 001 — exposition de secrets au déploiement

**Date.** 2026-09-22.

**Contexte.** Premier déploiement en production sur Vercel via `npx vercel deploy --prod`,
depuis le répertoire local du projet (pas de déploiement Git-based).

**Cause.** `vercel deploy` en CLI, appelé sur un répertoire local, ne filtre pas les fichiers
uploadés d'après `.gitignore`. Seul un fichier `.vercelignore` explicite fait foi ; en son
absence, `vercel deploy` uploade l'intégralité du répertoire de travail. Le projet n'avait
pas encore de `.vercelignore` au moment du premier déploiement : `.env` a été inclus dans la
source uploadée, et Next.js l'a chargé pendant le build (`- Environments: .env` dans les logs).

**Détection.** Vérification systématique post-déploiement de la liste des fichiers de la
source déployée via l'API Vercel (`GET /v6/deployments/{id}/files`), effectuée avant de
confirmer le déploiement comme terminé. `.env` y apparaissait (`/src/.env`).

**Portée réelle constatée.**
- Projet Vercel **privé** : la source déployée, y compris `.env`, n'était visible que par le
  compte propriétaire du projet — jamais accessible publiquement.
- `curl https://<url>/.env` → **404** : Next.js ne sert aucun fichier source arbitraire,
  seuls `app/` et `public/` sont exposés en HTTP. Aucune fuite via une requête externe.
- Dépôt **GitHub non affecté** : `.env` n'a jamais été suivi par git (`.gitignore` correct
  dès l'initialisation du dépôt), donc jamais présent dans l'historique ni sur GitHub.
- Résumé : exposition confinée au tableau de bord/API Vercel du propriétaire du projet,
  jamais publique, jamais sur GitHub.

**Correction de la cause.** Création de `.vercelignore` (exclut `.env`, `.env.local`,
`.env*.local`, `.git`, `docs/`, `scripts/`). Le déploiement fautif (`dpl_7rd5eAn5c8otToLRmDEims95TYi3`)
a été supprimé via `vercel rm`. Redéploiement effectué ; liste des fichiers de la nouvelle
source vérifiée : `.env` absent.

**Rotation appliquée par principe.** Même en l'absence de fuite publique constatée, tout
secret qui a transité par un chemin non prévu est traité comme potentiellement compromis :

| Secret | Rotation |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` (mot de passe Neon) | ✅ Rotée |
| `GEMINI_API_KEY` | ✅ Rotée |
| `SESSION_SECRET` | ✅ Régénérée (32 octets aléatoires, hex) |
| `ADMIN_PASSWORD` | ✅ Régénéré deux fois (18 octets aléatoires, base64url), hash Argon2id resynchronisé — voir Incident 001-bis |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | ✅ Rotée (nouvelle base Upstash) |

**Rotation complète : 6/6 secrets.**

Les 6 variables d'environnement de production sur Vercel ont été mises à jour avec les
nouvelles valeurs à chaque rotation, suivies d'un redéploiement et d'une vérification de
statut HTTP 200.

**Leçon retenue.** `.gitignore` protège un dépôt git ; il ne protège **rien** en dehors de
git. Chaque outil de déploiement a son propre mécanisme d'exclusion (`.vercelignore` pour
Vercel) et l'absence de ce fichier n'est pas un no-op silencieux — c'est un fail-open. La
vérification qui aurait dû exister *avant* le premier déploiement (lister les fichiers de la
source déployée et y chercher `.env`) existe maintenant *après coup* comme étape systématique
de toute procédure de déploiement sur ce projet.

---

### Incident 001-bis — mot de passe régénéré exposé hors de `.env`

**Contexte.** Pendant le traitement de l'Incident 001, un `ADMIN_PASSWORD` nouvellement
généré a été exposé par l'utilisateur en dehors de `.env` (recopié dans un canal hors du
fichier de configuration).

**Détection.** Immédiate — signalé par l'utilisateur lui-même dès que constaté.

**Correction.** Nouveau `ADMIN_PASSWORD` regénéré (18 octets aléatoires, base64url), écrit
dans `.env`, hash Argon2id resynchronisé via `prisma db seed`. L'ancien hash est invalidé :
aucune session ni aucun accès ne peut plus être ouvert avec l'ancien mot de passe.

**Leçon retenue.** Un secret ne doit jamais être affiché en sortie d'outil ni recopié dans un
canal de communication, même privé — y compris pendant la remédiation d'un incident de
sécurité. La remédiation elle-même est un moment à risque : générer un nouveau secret ne vaut
que si sa diffusion est aussi étroitement contrôlée que celle de l'ancien.

---

## Incident 002 — quota de rate limit partagé entre environnements

**Date.** 2026-09-22.

**Contexte.** Tests de connexion en local (`npm run dev`) et vérification manuelle du rate
limit en production utilisaient la **même base Upstash** — `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN` sont identiques dans `.env` et dans les variables de production
Vercel (décision D5, un seul projet Upstash pour tout le cycle de vie).

**Conséquence constatée.** Des tests locaux répétés ont consommé le quota de rate limit du
compte admin **en production** (`rl:login:acct:neltolofon@gmail.com`, 5 tentatives/15 min) :
une tentative de connexion réelle, avec le bon mot de passe, s'est retrouvée bloquée par le
message « Trop de tentatives » — pas un faux positif, le mécanisme a fonctionné exactement
comme conçu, mais contre l'environnement qu'il ne fallait pas cibler.

**Cause.** Aucune isolation par environnement sur les clés Redis. `dev`, `preview` et
`production` partagent tout : rate limit, cache versionné, verrou de créneau, cache de
session.

**Correction.** `lib/redis.ts` préfixe désormais toutes les clés par
`ENV = process.env.VERCEL_ENV ?? 'dev'` (voir `ARCHITECTURE.md` § Infrastructure). Une
tentative de connexion locale et une tentative en production n'affectent plus le même
compteur.

**Leçon retenue.** Une seule base partagée entre environnements est un choix d'infrastructure
défendable (coût, simplicité) — mais seulement si chaque client applicatif isole ses propres
clés. Sans ce préfixe, l'environnement de test devient un vecteur de déni de service contre
la production, par sa propre équipe.
