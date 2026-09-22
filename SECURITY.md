# Security

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
