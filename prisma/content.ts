/**
 * prisma/content.ts
 *
 * Contenu réel du portfolio, rédigé à partir de trois sources vérifiables :
 *   - le CV (Suhrago Nelkaël TOLOFON, sept. 2026)
 *   - l'audit technique externe des six sites (docs/AUDIT-PROJETS.md)
 *   - les échanges de conception
 *
 * ⚠️ RÈGLE APPLIQUÉE : tout ce qui est écrit ici est soit un FAIT OBSERVÉ
 * (vérifiable en visitant le site), soit une information du CV. Aucune
 * intention, aucune motivation, aucune décision de conception n'a été
 * inventée.
 *
 * Les blocs marqués « À COMPLÉTER » attendent ce que seul toi peux dire :
 * POURQUOI tu as fait ces choix. Ils sont éditables depuis /admin, un par un,
 * sans toucher au code. Remplis-les à tête reposée — mais remplis-les :
 * c'est ce qui transforme « voici mes projets » en « voici comment je raisonne ».
 */

// ─────────────────────────────────────────────────────────────────────────────
//  PROFIL
// ─────────────────────────────────────────────────────────────────────────────

export const profile = {
  fullName: 'Suhrago Nelkaël Tolofon',

  /**
   * La déclaration d'ouverture, en très grande typographie.
   * Son angle vient des faits : cinq sites en production ET une licence
   * en sécurité informatique. Ce croisement est rare et vérifiable.
   */
  headline:
    "Je construis des applications web pour des clients réels.\nEt je sais comment on les attaque.",

  bio: `Développeur full-stack freelance depuis 2023, j'ai livré six applications web en production, dont trois pour des clients béninois : une entreprise de construction métallique, une marque de cosmétique naturelle, un producteur de jus.

Je suis en licence de sécurité informatique à la HECM, après un diplôme technique en installation et maintenance informatique et deux ans de formation autodidacte en développement. Je pratique l'analyse réseau et la détection — Kali Linux, Wireshark, outils SIEM — et je participe à des challenges CTF et à du bug bounty.

Ce qui m'intéresse est le point de rencontre : concevoir des systèmes en sachant comment on les casse. Dans mes projets, ça se traduit concrètement — jetons CSRF sur les formulaires, politique de sécurité de contenu stricte, limitation de débit sur les API, cache applicatif écrit à la main.`,

  location: 'Cotonou, Bénin',
  timezone: 'Africa/Lagos',
  email: 'neltolofon@gmail.com',

  // À COMPLÉTER : adapte à ta situation réelle
  availability: 'Disponible pour missions freelance et alternance',
  focusNow: 'Sécurité applicative et architectures de données',
  openToWork: true,

  socials: {
    github: 'https://github.com/neltolofon-dot',
    // linkedin: '',  // À COMPLÉTER si tu en as un
  },
}

// ─────────────────────────────────────────────────────────────────────────────
//  PROJETS — 6, ordonnés par force du dossier
// ─────────────────────────────────────────────────────────────────────────────

export const projects = [
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'koto-cosmetique',
    title: 'KÔTÔ Cosmétique',
    domain: 'E-commerce',
    role: 'Conception et développement full-stack',
    year: 2026, // À VÉRIFIER
    status: 'PUBLISHED',
    featured: true,
    order: 0,
    stack: ['PHP', 'MySQL', 'JavaScript', 'Apache'], // MySQL à confirmer
    links: { live: 'https://koto-cosmetique.com/' },

    summary:
      "Boutique en ligne complète pour une marque béninoise de cosmétique naturelle : catalogue à variantes, panier, comptes clients, tunnel de commande et suivi. Construite en PHP sans framework.",

    outcomes: [
      'Tunnel de commande complet : panier, variantes, quantités, code promo, livraison',
      'Espace client avec création de compte au moment du paiement',
      'Plus de vingt pages éditoriales : ingrédients, conseils, impact, certifications',
    ],

    content: `## Le produit

KÔTÔ est une marque béninoise de cosmétique naturelle — savons noirs, huiles, shampooings — construite autour d'un discours de sensibilisation contre la dépigmentation et de mise en avant des coopératives de femmes productrices.

Le site n'est pas une vitrine : c'est une boutique qui vend.

## Ce qui est en production

**Le tunnel d'achat, de bout en bout.** Fiche produit avec sélection de variante et de quantité, panier persistant avec mise à jour et retrait d'article, code promo, sous-total et total en FCFA, page de livraison, redirection vers le paiement, puis suivi de commande.

**Des comptes clients**, avec création proposée au moment du passage en caisse plutôt qu'imposée en amont — la friction est placée là où le client est déjà engagé.

**Vingt-et-une pages éditoriales** : histoire de la marque, fiches ingrédients (karité, bissap, curcuma, baobab), articles de conseils, impact social, distinctions, expositions, et l'ensemble des pages légales — mentions, confidentialité, CGV, cookies.

**Sessions PHP natives** (\`PHPSESSID\`), sans dépendance à un framework ni à une plateforme e-commerce. Aucune trace de WordPress, WooCommerce, PrestaShop ou Shopify : tout est écrit.

## À COMPLÉTER — tes décisions

<!--
Réponds à ces questions dans /admin, en quelques phrases chacune.
Ce sont celles qu'un recruteur technique te posera :

- Pourquoi PHP sans framework plutôt que Laravel, que tu connais ?
  (contrainte d'hébergement mutualisé ? budget client ? délai ?)
- Comment tu gères la persistance du panier entre les visites ?
- Comment tu sécurises les comptes clients — hachage, sessions, expiration ?
- Comment tu te protèges de l'IDOR sur le suivi de commande : qu'est-ce qui
  empêche quelqu'un de lire la commande d'un autre en changeant l'identifiant ?
- Quels moyens de paiement, et comment ils sont intégrés ?
-->`,
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'mydayplanner',
    title: 'MyDayPlanner',
    domain: 'Productivité',
    role: 'Conception et développement',
    year: 2026, // À VÉRIFIER
    status: 'PUBLISHED',
    featured: true,
    order: 1,
    stack: ['Next.js', 'TypeScript', 'React', 'PWA', 'Vercel'], // TS à confirmer
    links: { live: 'https://mydayplanner-xi.vercel.app/' },

    summary:
      "Application de planification qui place automatiquement les tâches dans les créneaux libres d'un emploi du temps, à partir d'une description en langage naturel. Installable comme application mobile.",

    outcomes: [
      'Placement automatique sans conflit horaire, à partir de langage naturel',
      'Application installable (PWA) avec service worker',
      'Lighthouse : 82 performance, 95 accessibilité, 100 bonnes pratiques, 100 SEO',
    ],

    content: `## Le produit

Décrire ses tâches en langage naturel et obtenir une semaine organisée, sans conflit horaire, qui tient compte des contraintes récurrentes — cours, activités fixes.

## Ce qui est en production

**Next.js avec l'App Router**, compilé par Turbopack. Aucune bibliothèque JavaScript tierce : uniquement les bundles de premier parti. Le poids client est entièrement maîtrisé.

**Authentification par Server Actions**, avec un cookie de session **HttpOnly** — vérifié : \`document.cookie\` est vide côté navigateur, la session est donc inaccessible au JavaScript et un XSS ne peut pas la voler.

**Application installable (PWA)** : service worker actif et manifeste web. L'application fonctionne comme une application mobile, installable depuis le navigateur.

**En-têtes de sécurité** posés en production : \`Strict-Transport-Security\`, \`X-Frame-Options: DENY\`, \`X-Content-Type-Options: nosniff\`.

**Mesures Lighthouse** : performance 82, accessibilité 95, bonnes pratiques 100, SEO 100.

## À COMPLÉTER — tes décisions

<!--
Le cœur technique du projet, et la question qu'on te posera en premier :

- Comment fonctionne l'algorithme de placement ? Où vit la résolution
  de conflits — client, serveur, base ?
- Comment tu transformes du langage naturel en tâches structurées ?
  Quel modèle, quel format de sortie, comment tu valides le résultat ?
- Pourquoi une PWA plutôt qu'une application native ?
- Qu'est-ce qui t'a coûté le plus de temps, et pourquoi ?
-->`,
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'thm-roadmap',
    title: 'THM Roadmap',
    domain: 'Cybersécurité',
    role: 'Conception, collecte de données et développement',
    year: 2026,
    status: 'PUBLISHED',
    featured: true,
    order: 2,
    stack: ['React', 'Vite', 'Cloudflare Pages', 'Render'],
    links: { live: 'https://thm-roadmap.pages.dev' },

    summary:
      "Catalogue indépendant des 714 rooms gratuites de TryHackMe, filtrable et enrichi de parcours d'apprentissage construits à la main. Frontend sur Cloudflare Pages, API séparée avec limitation de débit.",

    outcomes: [
      '714 rooms gratuites cataloguées et catégorisées',
      'Parcours d\'apprentissage écrits à la main, avec suivi de progression',
      'Accessibilité Lighthouse : 100',
    ],

    content: `## Le produit

TryHackMe ne permet pas de voir facilement ce qui reste accessible sans abonnement, ni dans quel ordre l'aborder. THM Roadmap répond aux deux : un catalogue filtrable des 714 rooms gratuites, et des parcours d'apprentissage construits à la main par-dessus.

Projet indépendant, sans affiliation à TryHackMe — c'est indiqué explicitement sur le site.

## Ce qui est en production

**Architecture séparée** : une application React compilée par Vite, servie en statique depuis Cloudflare Pages, et une API distincte hébergée sur Render. Le frontend ne parle qu'à cette API.

**Politique de sécurité de contenu stricte** : \`default-src 'self'\`, avec \`connect-src\` restreint au seul domaine de l'API. Un script injecté ne pourrait exfiltrer vers aucune autre destination.

**Limitation de débit côté API** : fenêtre glissante de 120 requêtes, en-têtes \`x-ratelimit-*\` présents sur les réponses.

**Aucune bibliothèque tierce** embarquée : uniquement les chunks de premier parti, découpés par domaine — catalogue, parcours, progression.

**Accessibilité Lighthouse : 100.**

## Limite connue

L'API tourne sur l'offre gratuite de Render, qui met le service en veille après inactivité. Un premier appel après une période creuse peut prendre plus de vingt secondes — mesuré à 24,5 secondes lors de l'audit. C'est un compromis de coût assumé sur un projet personnel, pas un défaut de conception ; la correction serait un hébergement payant ou une tâche de maintien en éveil.

## À COMPLÉTER — tes décisions

<!--
- Comment tu as collecté les 714 rooms ? Quel outil, quelle stratégie,
  quel rythme pour ne pas te faire bloquer ?
- Est-ce que tu as respecté le robots.txt et limité ton débit ?
  → Si oui, DIS-LE. Sur un profil sécurité, montrer qu'on collecte
    de façon responsable est un signal de maturité fort.
- Comment tu as catégorisé les rooms et construit les parcours ?
- Comment tu maintiens le catalogue à jour ?
- Pourquoi Cloudflare Pages plutôt que Vercel ?
- Pourquoi une API séparée plutôt qu'un site statique avec les données
  embarquées ?
-->`,
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'hashvault',
    title: 'HashVault',
    domain: 'Sécurité applicative',
    role: 'Conception et développement',
    year: 2026, // À VÉRIFIER
    status: 'PUBLISHED',
    featured: false,
    order: 3,
    stack: ['PHP', 'Bootstrap', 'GSAP'],
    links: { live: 'https://hashvault.freehosting.dev/' },

    summary:
      "Espace de notes personnelles chiffrées, protégé par compte. Chaque utilisateur ne voit que ses propres notes. Formulaires protégés par jeton CSRF.",

    outcomes: [
      'Notes chiffrées au repos',
      'Cloisonnement strict des données par utilisateur',
      'Jeton CSRF sur les formulaires d\'authentification',
    ],

    content: `## Le produit

Un espace de notes personnelles : créer, consulter, modifier et supprimer ses notes depuis un tableau de bord, chaque utilisateur ne voyant que les siennes.

## Ce qui est en production

**Chiffrement des notes au repos** — les notes ne sont pas stockées en clair en base.

**Protection CSRF explicite** : le formulaire de connexion porte un champ \`csrf_token\` caché, soumis en POST. C'est une protection qu'aucun framework ne fournissait ici — elle a été implémentée à la main.

**Cloisonnement par utilisateur** : l'accès aux notes est restreint au compte propriétaire.

**Rendu serveur en PHP**, interface construite avec Bootstrap 5.3 et animations GSAP.

## Le lien avec ce projet-ci

HashVault et cette plateforme résolvent le même problème fondamental : des données privées, un contrôle d'accès, et la garantie qu'un utilisateur ne peut pas lire celles d'un autre. Le raisonnement est le même, poussé plus loin ici — vérification d'autorisation au contact de la donnée plutôt que dans une couche intermédiaire.

## À COMPLÉTER — tes décisions

<!--
Les trois questions qu'un jury sécurité posera, dans cet ordre :

1. Avec quel algorithme les notes sont-elles chiffrées ?
2. OÙ VIT LA CLÉ ? Sur le serveur, ou dérivée du mot de passe utilisateur
   côté client ?
   → serveur : protège d'un vol de base, pas d'une compromission serveur
   → dérivée côté client : chiffrement de bout en bout, tu ne peux pas
     lire les notes de tes propres utilisateurs — beaucoup plus fort
   Les deux sont défendables. Il faut savoir dire laquelle et pourquoi.
3. Comment tu empêches l'IDOR — quelqu'un qui change l'identifiant d'une
   note dans l'URL pour lire celle d'un autre ?
-->`,
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'genie-metal-plus',
    title: 'Genie Metal Plus',
    domain: 'Industrie',
    role: 'Conception et développement full-stack',
    year: 2025, // À VÉRIFIER
    status: 'PUBLISHED',
    featured: false,
    order: 4,
    stack: ['PHP', 'Apache', 'JavaScript'],
    links: { live: 'https://ecbservice-at.com/' },

    summary:
      "Site vitrine et générateur de devis pour une entreprise de construction métallique à Cotonou. Huit domaines de services, galerie de réalisations, et une prise de contact qui passe par le canal réellement utilisé au Bénin : WhatsApp.",

    outcomes: [
      'Sept pages, huit domaines de services, galerie de réalisations filtrable',
      'Double canal de contact : formulaire et WhatsApp contextuel',
      'Couche de cache applicative écrite à la main',
    ],

    content: `## Le client

Genie Metal Plus SARL, construction métallique et BTP à Agblangandan, Cotonou. Huit domaines : charpentes métalliques, BTP, portes et portails, escaliers, grilles et clôtures, enseignes, silos industriels, menuiserie aluminium.

## Ce qui est en production

**Une couche de cache écrite à la main.** Les réponses portent un en-tête \`X-GMP-Cache: MISS\` — ce n'est aucun système de cache connu, c'est un mécanisme développé pour ce site. Sur un hébergement mutualisé, sans Redis ni Varnish, c'est la réponse pragmatique au coût de rendu des pages.

**Politique de sécurité de contenu** déclarée, avec une liste blanche explicite des origines externes autorisées.

**Double canal de prise de contact** : un formulaire classique sur \`contact.php\`, et des liens WhatsApp directs avec **message pré-rempli selon le contexte** — la demande de devis n'ouvre pas le même message que le contact général.

**Sept pages** en PHP, rendu serveur, sans framework.

## Le choix produit à défendre

Le contact principal passe par WhatsApp, pas par un formulaire. Ce n'est pas un raccourci technique : au Bénin, c'est le canal que les clients utilisent réellement. Un formulaire qui envoie un e-mail à une adresse consultée une fois par semaine convertit moins qu'un message WhatsApp qui arrive sur le téléphone du gérant.

Concevoir pour les usages réels de ses utilisateurs plutôt que pour les conventions du web occidental est une décision produit — et c'est un argument que peu de candidats peuvent tenir.

## À COMPLÉTER — tes décisions

<!--
- Comment tu as eu ce client, et quel était son problème avant le site ?
- Comment fonctionne ta couche de cache (X-GMP-Cache) ? Qu'est-ce que
  tu mets en cache, comment tu l'invalides ?
  → C'est ton point technique le plus intéressant ici. Développe.
- Pourquoi PHP natif plutôt que Laravel ?
- Le site a-t-il produit des résultats mesurables pour le client ?
-->`,
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'fruita',
    title: 'FRUITA',
    domain: 'Agroalimentaire',
    role: 'Conception et développement',
    year: 2025, // À VÉRIFIER
    status: 'PUBLISHED',
    featured: false,
    order: 5,
    stack: ['HTML', 'CSS', 'JavaScript', 'Netlify'],
    links: { live: 'https://fruita-benin.netlify.app/' },

    summary:
      "Vitrine commerciale pour une marque béninoise de jus d'ananas. Aucun framework : HTML, CSS et JavaScript, une page à ancres, et la commande qui part directement sur WhatsApp avec le détail du panier pré-rempli.",

    outcomes: [
      'Zéro dépendance JavaScript — site statique complet',
      'Cinq points de commande WhatsApp contextuels, messages pré-remplis',
      'Programme de recrutement de revendeurs intégré',
    ],

    content: `## Le produit

Marque béninoise de jus d'ananas naturel. Deux formats — pack de 6 canettes à 1 700 FCFA, pack de 24 à 6 500 FCFA — paiement en mobile money, espèces ou virement, livraison dans tout le Bénin.

## Ce qui est en production

**Aucun framework, aucune bibliothèque tierce.** HTML, CSS et un seul fichier JavaScript de premier parti. Une page unique à ancres.

**Cinq liens WhatsApp contextuels**, chacun avec un message pré-rempli différent : commande générale, commande d'un pack de 6 avec le détail, commande d'un pack de 24, et deux contacts dédiés au recrutement de revendeurs. Le client n'a rien à taper.

**Aucun formulaire, aucun \`mailto:\`** — tout passe par le canal que la clientèle utilise.

## Le choix à assumer

Ne pas installer de framework sur un site de cette nature est une décision, pas un manque. Il n'y avait pas d'état à gérer, pas de routage, pas de données dynamiques : React aurait ajouté quarante kilo-octets de JavaScript et une étape de build pour afficher deux packs et cinq liens.

**Savoir ne pas sur-outiller est une compétence.** Le site se charge instantanément et n'a aucune dépendance à maintenir.

## À CORRIGER — 2 minutes

L'audit a relevé un **404 sur \`assets/images/logo.svg\`** : le logo est cassé sur la page en ligne. À réparer avant que quiconque visite ce lien depuis ton portfolio.

## À COMPLÉTER — tes décisions

<!--
- Client réel ou projet personnel ?
- Le score de performance mesuré est de 54 — qu'est-ce qui pèse ?
  (images non optimisées ?) Si tu le corriges, tu pourras écrire
  "de 54 à X après optimisation" : un avant/après chiffré vaut mieux
  qu'un score parfait sans histoire.
-->`,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  EXPÉRIENCES — du CV
// ─────────────────────────────────────────────────────────────────────────────

export const experiences = [
  {
    org: 'Freelance',
    role: 'Développeur web full-stack',
    location: 'Cotonou, Bénin',
    startDate: '2023-01-01',
    endDate: null,
    current: true,
    order: 0,
    summary:
      "Conception et développement d'applications web pour des clients béninois et des projets personnels. Six sites livrés en production, du site vitrine à la boutique en ligne complète.",
    highlights: [
      'KÔTÔ Cosmétique — boutique en ligne : catalogue à variantes, panier, comptes clients, tunnel de commande et suivi',
      'Genie Metal Plus — site vitrine et devis pour une entreprise de construction métallique, avec couche de cache applicative',
      'FRUITA — vitrine commerciale sans framework, commande par WhatsApp',
      'MyDayPlanner — application de planification installable, Next.js et PWA',
    ],
  },
  {
    org: 'HECM — Haute École de Commerce et de Management',
    role: 'Licence en sécurité informatique',
    location: 'Bénin',
    startDate: '2025-10-01', // À VÉRIFIER
    endDate: null,
    current: true,
    order: 1,
    summary: 'Développement et cybersécurité.',
    highlights: [
      // À COMPLÉTER : modules concrets, projets académiques marquants
    ],
  },
  {
    org: 'Pratique personnelle en cybersécurité',
    role: 'Analyse réseau, SOC, CTF et bug bounty',
    startDate: '2023-01-01',
    endDate: null,
    current: true,
    order: 2,
    summary:
      "Exercices d'analyse réseau et de détection avec Kali Linux, Wireshark et des outils SIEM. Participation à des challenges CTF et à du bug bounty depuis 2024 : détection de vulnérabilités, exploitation contrôlée et rédaction de rapports.",
    highlights: [
      '714 rooms gratuites TryHackMe cataloguées et structurées dans THM Roadmap',
      // À COMPLÉTER : nombre de rooms complétées, plateformes CTF, une
      // vulnérabilité trouvée dont tu es fier (même mineure, même sans prime)
    ],
  },
  {
    org: 'IMI',
    role: 'Diplôme technique — installation et maintenance informatique',
    startDate: '2024-01-01', // À VÉRIFIER
    endDate: '2025-01-01', // À VÉRIFIER
    current: false,
    order: 3,
    summary: 'Installation et maintenance informatique.',
    highlights: [],
  },
  {
    org: 'AÏSSROL BUSINESS CENTER',
    role: 'Stagiaire en administration réseau',
    startDate: '2021-01-01', // À VÉRIFIER
    endDate: '2022-01-01', // À VÉRIFIER
    current: false,
    order: 4,
    summary: '', // À COMPLÉTER : que faisais-tu concrètement ? quelle taille de parc ?
    highlights: [],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  COMPÉTENCES
//
//  ⚠️ Chaque `context` est un FAIT VÉRIFIABLE par quiconque visite le site
//  concerné. C'est ce qui rend cette section crédible là où « React 85 % »
//  ne prouve rien — et c'est exactement ce que le chatbot RAG citera.
// ─────────────────────────────────────────────────────────────────────────────

export const skills = [
  // ─── Développement web ───
  {
    name: 'PHP',
    category: 'Développement web',
    order: 0,
    context:
      'Trois sites en production sans framework : KÔTÔ (e-commerce complet), Genie Metal Plus, HashVault',
  },
  {
    name: 'JavaScript',
    category: 'Développement web',
    order: 1,
    context: 'FRUITA entièrement en vanilla, sans aucune dépendance tierce',
  },
  {
    name: 'React',
    category: 'Développement web',
    order: 2,
    context: 'THM Roadmap, application monopage compilée par Vite',
  },
  {
    name: 'Next.js (App Router)',
    category: 'Développement web',
    order: 3,
    context:
      'MyDayPlanner en production : Server Actions, cookie de session HttpOnly, PWA. Et cette plateforme.',
  },
  {
    name: 'TypeScript',
    category: 'Développement web',
    order: 4,
    context: '', // À COMPLÉTER — sois honnête, c'est la section la plus vérifiable
  },
  {
    name: 'Flutter',
    category: 'Développement web',
    order: 5,
    context: '', // À COMPLÉTER ou SUPPRIMER si rien de livré
  },

  // ─── Sécurité applicative ───
  {
    name: 'Protection CSRF',
    category: 'Sécurité applicative',
    order: 0,
    context: 'Jeton CSRF implémenté à la main sur les formulaires de HashVault',
  },
  {
    name: 'Content Security Policy',
    category: 'Sécurité applicative',
    order: 1,
    context:
      "CSP stricte default-src 'self' sur THM Roadmap, connect-src restreint au seul domaine de l'API",
  },
  {
    name: 'Rate limiting',
    category: 'Sécurité applicative',
    order: 2,
    context:
      'Fenêtre glissante de 120 requêtes sur l\'API THM Roadmap ; double fenêtre IP et compte sur cette plateforme',
  },
  {
    name: 'Sessions et authentification',
    category: 'Sécurité applicative',
    order: 3,
    context:
      'Sessions PHP natives sur KÔTÔ et HashVault, cookie HttpOnly sur MyDayPlanner, sessions opaques Argon2id ici',
  },
  {
    name: 'Chiffrement au repos',
    category: 'Sécurité applicative',
    order: 4,
    context: 'Notes chiffrées en base sur HashVault',
  },
  {
    name: 'OWASP Top 10',
    category: 'Sécurité applicative',
    order: 5,
    context: '', // À COMPLÉTER — formation HECM ? rooms TryHackMe ? lesquelles ?
  },

  // ─── Sécurité offensive ───
  {
    name: 'Kali Linux',
    category: 'Sécurité offensive',
    order: 0,
    context: "Pratique régulière depuis 2023, exercices SOC et d'analyse réseau",
  },
  {
    name: 'Wireshark',
    category: 'Sécurité offensive',
    order: 1,
    context: 'Analyse de trafic réseau, pratique depuis 2023',
  },
  {
    name: 'SIEM',
    category: 'Sécurité offensive',
    order: 2,
    context: '', // À COMPLÉTER — lequel ? Splunk, Wazuh, ELK ?
  },
  {
    name: 'CTF et bug bounty',
    category: 'Sécurité offensive',
    order: 3,
    context:
      'Depuis 2024 : détection de vulnérabilités, exploitation contrôlée, rédaction de rapports',
  },
  {
    name: 'TryHackMe',
    category: 'Sécurité offensive',
    order: 4,
    context: '714 rooms gratuites cataloguées et structurées dans THM Roadmap',
  },

  // ─── Infrastructure ───
  {
    name: 'Cache applicatif',
    category: 'Infrastructure',
    order: 0,
    context:
      "Couche de cache écrite à la main sur Genie Metal Plus (en-tête X-GMP-Cache), cache Redis versionné ici",
  },
  {
    name: 'Déploiement',
    category: 'Infrastructure',
    order: 1,
    context:
      'Vercel, Netlify, Cloudflare Pages, Render et hébergement mutualisé Apache selon les contraintes du projet',
  },
  {
    name: 'PostgreSQL / Prisma',
    category: 'Infrastructure',
    order: 2,
    context: '', // À COMPLÉTER honnêtement
  },
  {
    name: 'PWA',
    category: 'Infrastructure',
    order: 3,
    context: 'Service worker et manifeste sur MyDayPlanner, application installable',
  },

  // ─── Produit et design ───
  {
    name: "Conception d'interfaces",
    category: 'Produit et design',
    order: 0,
    context: 'Six sites conçus de bout en bout, de la maquette à la mise en production',
  },
  {
    name: 'Conception pour le marché béninois',
    category: 'Produit et design',
    order: 1,
    context:
      "Trois sites font passer la commande par WhatsApp avec messages pré-remplis : c'est le canal réellement utilisé par les clients, pas un raccourci technique",
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  SERVICES
// ─────────────────────────────────────────────────────────────────────────────

export const services = [
  {
    slug: 'appel-decouverte',
    name: 'Appel de découverte',
    durationMin: 30,
    bufferMin: 15,
    order: 0,
    description:
      'Présentons-nous. Votre projet, vos contraintes, votre calendrier — et si je suis la bonne personne pour y répondre.',
  },
  {
    slug: 'revue-technique',
    name: 'Revue technique',
    durationMin: 60,
    bufferMin: 15,
    order: 1,
    description:
      "Revue d'une base de code, d'une architecture ou d'une surface d'attaque. Je repars avec des constats écrits, vous repartez avec une liste priorisée.",
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  ARTICLES — squelettes, à écrire depuis /admin
// ─────────────────────────────────────────────────────────────────────────────

export const articles = [
  {
    slug: 'middleware-nextjs-frontiere-securite',
    title: "Pourquoi le middleware Next.js n'est pas une frontière de sécurité",
    status: 'DRAFT',
    tags: ['Next.js', 'Sécurité', 'Architecture'],
    excerpt:
      "Next.js 16 a renommé middleware en proxy. Ce n'est pas cosmétique : c'est un aveu sur ce que cette couche peut et ne peut pas garantir.",
    content: `<!--
À ÉCRIRE — tu vivras ce sujet en construisant cette plateforme.

Le plan est déjà là :
1. Ce que tout le monde fait : if (!session) redirect() dans le middleware
2. Pourquoi ça semble logique — et pourquoi c'est faux
3. CVE-2026-64642 : une requête forgée saute la couche entière
4. Le renommage en "proxy" : Vercel documente une frontière RÉSEAU,
   à n'utiliser qu'en dernier recours
5. Ce que je fais à la place : requireAdmin() au contact de la donnée
6. La preuve : curl sur une API admin renvoie 401, pas une redirection

Un article écrit depuis ta propre implémentation, que le jury peut
vérifier dans ton code. C'est imbattable.
-->`,
  },
  {
    slug: 'whatsapp-plutot-quun-panier',
    title: 'WhatsApp plutôt qu\'un panier : concevoir pour le marché béninois',
    status: 'DRAFT',
    tags: ['Produit', 'Bénin', 'E-commerce'],
    excerpt:
      "Trois de mes sites font passer la commande par WhatsApp. Ce n'est pas un raccourci technique, c'est une décision produit fondée sur les usages réels.",
    content: `<!--
À ÉCRIRE — c'est l'article qui te distingue le plus.

Tu as la matière dans trois projets :
- FRUITA : cinq liens contextuels, messages pré-remplis
- Genie Metal Plus : WhatsApp ET formulaire, pourquoi les deux
- KÔTÔ : un vrai tunnel de commande, pourquoi là c'était justifié

Le fil : un formulaire qui envoie un e-mail à une adresse consultée une
fois par semaine convertit moins qu'un message qui arrive sur le téléphone
du gérant. Concevoir pour ses utilisateurs réels plutôt que pour les
conventions du web occidental.

Aucun candidat n'aura écrit ça.
-->`,
  },
]
