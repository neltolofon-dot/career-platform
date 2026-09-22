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
| `ADMIN_PASSWORD` | ✅ Régénéré (18 octets aléatoires, base64url), hash Argon2id resynchronisé |
| `UPSTASH_REDIS_REST_TOKEN` | ⚠️ **Non rotée** — reste avec sa valeur d'origine. Point ouvert. |

Les 6 variables d'environnement de production sur Vercel ont été mises à jour avec les
nouvelles valeurs et un nouveau déploiement a été effectué.

**Leçon retenue.** `.gitignore` protège un dépôt git ; il ne protège **rien** en dehors de
git. Chaque outil de déploiement a son propre mécanisme d'exclusion (`.vercelignore` pour
Vercel) et l'absence de ce fichier n'est pas un no-op silencieux — c'est un fail-open. La
vérification qui aurait dû exister *avant* le premier déploiement (lister les fichiers de la
source déployée et y chercher `.env`) existe maintenant *après coup* comme étape systématique
de toute procédure de déploiement sur ce projet.
