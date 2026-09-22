# Architecture — Personal Career Platform

## Infrastructure

**Isolation par environnement (Redis).** Une seule base Upstash sert le dev, les preview et
la production. Sans préfixe, un test local consomme le quota de rate limit de production et
invalide le cache des visiteurs réels. Toutes les clés Redis (`lib/redis.ts`) sont préfixées
par `ENV = process.env.VERCEL_ENV ?? 'dev'` (`production` | `preview` | `dev`) : rate limit de
login, cache versionné du portfolio, compteur d'événements SSE, verrou de créneau, cache de
session.
