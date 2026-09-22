# Direction artistique — « Dossier technique »

> Ce document est **normatif**. Il est fait pour être collé dans le contexte de Codex / Claude Code
> à chaque tâche d'UI. Sans lui, une IA régresse systématiquement vers le portfolio dark-néon
> à cartes arrondies — c'est-à-dire exactement ce que le sujet interdit.

---

## 1. Le concept en une phrase

**Un dossier d'ingénierie mis en page comme une revue.** Encre sur papier, métadonnées en
marge, sections numérotées, tables plutôt que cartes, typographie qui porte la hiérarchie
à la place des boîtes et des ombres.

Le portfolio ne dit pas *« je suis développeur »*. Il **est** un document d'ingénieur :
il expose des faits, des dates, des références, un index. Le sujet demande que le visiteur
ait l'impression de connaître la personne avant d'avoir lu son CV — un document qui a de
la tenue le dit mieux qu'une page d'accueil qui crie.

### Pourquoi ce pari plutôt qu'un dark premium

Trois raisons, et elles sont toutes défendables à l'oral :

1. **Différenciation mécanique.** Le corpus d'entraînement des IA de code est saturé de
   portfolios sombres à gradient violet. Neuf soumissions sur dix ressembleront à ça — le
   sujet le dit lui-même dans sa liste d'interdits. Un fond clair éditorial est visible
   au premier coup d'œil dans une pile de rendus.
2. **Zéro dépendance aux images.** Tu n'as pas d'assets photographiques et les banques
   d'images sont interdites. Une DA typographique n'en a structurellement pas besoin :
   la matière visuelle, c'est la mise en page.
3. **Lisibilité sous audit.** Les jurés vont lire du contenu, pas admirer un hero. Un
   document clair et bien composé se lit mieux à 2 h du matin sur un écran de laptop.

---

## 2. Palette — encre sur papier

Cinq couleurs. Pas six.

| Token | Valeur | Usage | Interdit |
|---|---|---|---|
| `--paper` | `#FAF8F3` | Fond de page, unique | — |
| `--ink` | `#14130F` | Texte principal, filets, traits | Jamais du `#000` pur |
| `--ink-muted` | `#6B6760` | Métadonnées, labels, texte secondaire | — |
| `--rule` | `#DCD7CC` | Filets 1px, séparateurs, bordures de table | Jamais épaissi au-delà de 1px |
| `--vermilion` | `#C2410C` | **Accent unique** | Max **une** occurrence visible par écran |
| `--surface` | `#F2EEE5` | Aplat de section alternée, lignes de tableau au survol | Pas de carte flottante |

**La règle du vermillon.** C'est de l'encre rouge de correction, pas une couleur de marque.
Elle marque **une** chose à la fois : le chiffre de section actif, le lien survolé, l'état
disponible, le bouton primaire de l'écran. Deux vermillons visibles simultanément = erreur
de design à corriger.

**Pas de dark mode.** Décision assumée, documentée dans `ARCHITECTURE.md` (cf. D9).

**Contraste.** `--ink` sur `--paper` = ~16:1. `--ink-muted` sur `--paper` = ~5.2:1 (AA pour
du texte normal). `--vermilion` sur `--paper` = ~4.9:1 — **valide pour du texte, pas pour
du texte de moins de 14px en graisse légère.**

---

## 3. Typographie

Trois familles, trois rôles disjoints. Aucun chevauchement.

| Rôle | Fonte | Chargement | Usage |
|---|---|---|---|
| Display | **Fraunces** (variable, axes `SOFT` + `WONK`) | `next/font/google`, subset latin, `display: 'swap'` | Titres de section, déclaration d'ouverture, titres de projet |
| Corps | **Inter** (variable) | `next/font/google` | Paragraphes, formulaires, interface admin |
| Données | **Geist Mono** | `next/font/google` | Numéros de section, années, labels en marge, stack, chiffres, tout l'admin |

Trois fontes variables = trois requêtes, toutes préchargées et auto-hébergées par `next/font`
(pas de requête vers `fonts.googleapis.com`, ce qui évite aussi une exception dans la CSP).

### Le geste signature : Fraunces en mode `wonk`

```css
.display {
  font-family: var(--font-fraunces);
  font-variation-settings: "SOFT" 0, "WONK" 1, "opsz" 144;
  font-weight: 400;          /* jamais 700 en très grande taille */
  letter-spacing: -0.03em;
  line-height: 0.92;         /* interlignage NÉGATIF sur le display */
}
```

L'axe `WONK` de Fraunces active des formes de lettres irrégulières (le `g`, le `y`, les
terminaisons). C'est ce qui fait qu'on ne reconnaît pas une Google Font générique. Combiné
à un interlignage de 0.92 et un poids 400 en très grande taille, ça donne une composition
de revue, pas de landing page.

### Échelle

Ratio **1.333** pour le texte, saut brutal pour le display. Le contraste d'échelle extrême
est ce qui fait « éditorial ».

```
--text-2xs   : 0.6875rem   (11px)  mono, labels en marge
--text-xs    : 0.8125rem   (13px)  mono, métadonnées
--text-sm    : 0.9375rem   (15px)  interface, admin
--text-base  : 1.0625rem   (17px)  corps de texte — 17px, pas 16
--text-lg    : 1.375rem    (22px)  chapô
--text-xl    : 1.875rem    (30px)  titre de niveau 3
--text-2xl   : 2.5rem      (40px)  titre de section
--text-3xl   : clamp(3rem, 7vw, 5.5rem)     titre de page
--text-4xl   : clamp(4rem, 13vw, 11rem)     déclaration d'ouverture
```

Le saut de `--text-2xl` (40px) à `--text-4xl` (176px) **est** la hiérarchie visuelle. Rien
d'autre n'en a besoin.

### Mesure de ligne

Le corps de texte plafonne à **68 caractères** (`max-width: 34em`). Non négociable — c'est
le seul réglage qui distingue un texte composé d'un texte posé.

---

## 4. Grille et composition

### La colonne de métadonnées

La signature structurelle du site. Sur desktop, chaque section est composée en deux zones :

```
┌──────────────┬───────────────────────────────────────────────┐
│  MÉTADONNÉES │  CONTENU                                      │
│  (2 col)     │  (8 à 10 col, ancrage variable)               │
│              │                                               │
│  02 —        │  Trajectoire                                  │
│  2023-2026   │                                               │
│  4 ENTRÉES   │  [ le contenu de la section ]                 │
│  ↑ mono, 11px│                                               │
│  --ink-muted │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

La colonne de gauche porte : le numéro de section, l'intervalle temporel, le décompte,
le statut. Toujours en mono, toujours en `--text-2xs`, toujours en `--ink-muted`, toujours
en `position: sticky` sur la hauteur de la section.

Sur mobile, elle devient une ligne horizontale au-dessus du contenu, séparée par un filet.

### Ancrage asymétrique

**Le contenu ne se centre jamais.** Chaque section a un point d'ancrage différent dans la
grille de 12 colonnes :

| Section | Colonnes |
|---|---|
| 00 Ouverture | 1 → 11 |
| 01 Travaux | 1 → 12 (pleine largeur, c'est une table) |
| 02 Trajectoire | 3 → 10 |
| 03 Terrain | 4 → 12 |
| 04 Dialogue | 2 → 9 |
| 05 Contact | 5 → 12 |

C'est arbitraire et c'est le but : la composition doit donner l'impression d'une mise en
page décidée, pas d'un conteneur centré répété six fois.

### Espacement

Échelle en `rem`, basée sur 4px, avec des sauts francs :
`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 144 / 216`

Espacement vertical entre sections : **144px desktop, 80px mobile**. Le blanc est la
respiration du document — c'est là que 90 % des portfolios échouent en tassant tout.

---

## 5. Les six mouvements de la page publique

Pas de `Navbar / Hero / About / Skills / Projects / Contact / Footer`. Une narration numérotée.

### `00 — OUVERTURE`

Une **déclaration** typographique en `--text-4xl`, deux à trois lignes, qui dit ce que tu
fais et pour qui. Pas « Hello I'm ». Pas de photo. Pas de bouton « Download CV » en vermillon.

Sous la déclaration, un filet, puis une ligne de **métadonnées vivantes en mono** lues
depuis la base de données :

```
DISPONIBLE À PARTIR D'OCTOBRE · COTONOU, BJ (UTC+1) · FOCUS ACTUEL : SÉCURITÉ APPLICATIVE
```

C'est une donnée réelle, éditable depuis `/admin`. Elle prouve, dès le premier écran, que
le site est branché à une base — c'est le premier point de la note d'architecture.

### `01 — TRAVAUX`

**Une table, pas des cartes.** Le sujet interdit explicitement « une page composée uniquement
de cartes ». C'est le moment de le montrer.

```
ANNÉE   PROJET                    DOMAINE          RÔLE              STACK
────────────────────────────────────────────────────────────────────────────────
2026    ColocBenin                Immobilier       Full-stack        Next · Postgres
2026    Invisible Trador          Fintech          Architecte        MQL5 · Python
2025    GMP                       Institutionnel   Full-stack        Next · CMS
```

- Les lignes sont des liens. Au survol : fond `--surface`, l'année passe en `--vermilion`,
  et l'aperçu du projet apparaît dans une zone dédiée en marge (pas en tooltip flottant).
- Filets 1px entre les lignes, jamais de bordure de carte, jamais de `border-radius`.
- Cliquer navigue vers `/travaux/[slug]` avec une **View Transition** : le titre du projet
  persiste physiquement entre l'index et la page.

C'est l'écran qui gagne les 15 points de design, parce que c'est l'écran qu'aucune IA ne
produit spontanément.

### `02 — TRAJECTOIRE`

Chronologie en deux colonnes : dates et organisation en mono à gauche (sticky), texte à
droite. Un filet vertical 1px comme axe. Pas de « timeline » à pastilles et à connecteurs
arrondis.

### `03 — TERRAIN`

**Interdiction absolue des barres de progression et des pourcentages.** « React 85 % » ne
veut rien dire et signale un portfolio de débutant.

À la place : regroupement par catégorie, et pour chaque compétence, le champ `context`
de la base — *« utilisé en production sur ColocBenin et GMP »*. Un fait vérifiable vaut
mieux qu'une jauge inventée.

### `04 — DIALOGUE` (le chatbot)

**Pas de bulle flottante en bas à droite.** C'est le cliché absolu, et ça enterre le module
qui vaut 15 points sous un widget que personne ne clique.

Le chatbot est une **section à part entière** de la page : un grand champ de saisie éditorial
(filet bas uniquement, pas de boîte), précédé d'une phrase d'invitation, suivi de trois
questions suggérées **réelles** générées à partir du contenu en base :

```
Posez une question sur mon travail.

┌────────────────────────────────────────────────────────────────┐
│ Ex. : quels projets a-t-il menés dans le domaine bancaire ?    │
└────────────────────────────────────────────────────────────────┘
  ↑ filet bas 1px, pas de bordure complète

→ Quels projets en fintech ?   → Quelle expérience en sécurité ?   → Est-il disponible ?
```

**Les réponses affichent leurs sources.** Sous chaque réponse, les chunks utilisés
apparaissent en mono, cliquables, pointant vers le projet ou l'article d'origine :

```
SOURCES · PROJET / COLOCBENIN · EXPÉRIENCE / HECM
```

C'est la preuve visuelle que le RAG est réel. Un auditeur qui voit une réponse sourcée et
cliquable n'a plus besoin de te demander si le chatbot est truqué.

Quand aucune source ne passe le seuil, la réponse est le refus, affiché sans sources —
et c'est **volontairement visible**. Montre-le pendant la soutenance : pose une question
hors sujet et laisse le refus s'afficher. C'est plus convaincant que dix minutes d'explication.

Une fois qu'on a scrollé au-delà de cette section, une barre de saisie fine et discrète
reste ancrée en bas de viewport — pas un cercle flottant.

### `05 — CONTACT`

Deux voies côte à côte, séparées par un filet vertical :
- **Écrire** → crée `Contact` + `Conversation` + `Lead(NEW)` + `Notification` dans une seule transaction.
- **Réserver un créneau** → le module de booking.

Formulaires composés comme un formulaire de document : label en mono au-dessus, champ à
filet bas uniquement, pas de placeholder tenant lieu de label (anti-pattern d'accessibilité).

---

## 6. Motion

### Principe

**Le mouvement sert la lecture ou n'existe pas.** Le sujet interdit explicitement de
« multiplier les animations sans raison ». Quatre primitives, pas une de plus.

### Les quatre primitives

**M1 — Révélation typographique masquée.**
Les titres montent depuis un masque `overflow: hidden`, ligne par ligne, décalage 60 ms.
Uniquement sur les titres de section et la déclaration d'ouverture. Jamais sur un paragraphe.

**M2 — Transition de page à persistance.**
View Transitions API (native, supportée par Next.js 16). Le titre du projet persiste
physiquement entre l'index `01` et la page projet. `view-transition-name` posé sur le titre
et sur l'image de couverture.

**M3 — Entrée liée au scroll, en CSS pur.**
`animation-timeline: view()` — pas de `IntersectionObserver`, pas de Framer Motion.
Translation de 16px et opacité, 380 ms. La section reste un Server Component. **0 KB de JS.**
C'est l'argument performance de la soutenance.

**M4 — Réaction d'état.**
120 ms sur tout ce qui est interactif. Couleur et transformation uniquement — jamais de
transition sur `box-shadow`, `width` ou `height` (coût de layout).

### Tokens de timing

Une seule courbe pour tout le site :

```css
--ease: cubic-bezier(0.2, 0.7, 0.2, 1);
--dur-state: 120ms;
--dur-enter: 380ms;
--dur-page:  600ms;
```

Une courbe unique, c'est ce qui donne l'impression que tout le site bouge « de la même
main ». Trois easings différents, c'est du bruit.

### Accessibilité — non négociable

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    view-transition-name: none !important;
  }
}
```

C'est dans la grille d'évaluation frontend. Ça coûte 6 lignes.

---

## 7. L'espace admin

**Même design system, densité augmentée.** L'admin n'est pas un back-office moche collé
derrière un joli site — c'est le même produit vu de l'autre côté.

- Mono dominant : toutes les données tabulaires, tous les chiffres, tous les identifiants.
- `--text-sm` par défaut, espacement resserré (l'échelle d'espacement décroît d'un cran).
- Navigation latérale : liste de liens en mono, pas d'icônes. Le lien actif porte le filet
  vermillon à gauche.
- Tables denses, lignes à 40px, filets 1px, tri par en-tête, pagination en bas à droite
  en mono (`41–60 SUR 217`).
- Le pipeline CRM est la seule vue en colonnes : cinq colonnes à filets, cartes minimales
  (nom, société, valeur, âge du lead en mono), drag & drop.
- **Toute liste admin est paginée côté serveur.** C'est dans les exigences de sécurité du
  sujet, pas seulement une question de performance.

### Graphiques (dashboard analytics)

- Pas de camembert. Jamais.
- Vues par jour → aire ou barres, une seule série, `--ink` avec remplissage `--surface`.
- Le vermillon marque **un** point : le pic, ou la valeur du jour.
- Axes en mono `--text-2xs`, `--ink-muted`, filets `--rule`, pas de grille verticale.
- Pas de bibliothèque de charting : quelques `<rect>` et un `<path>` SVG générés côté
  serveur suffisent et coûtent 0 KB de JS. Recharts, c'est ~90 KB pour trois barres.

---

## 8. Interdits — à copier tel quel dans le contexte de Codex

```
INTERDIT DANS CE PROJET — aucune exception :

✗ border-radius > 2px sur quoi que ce soit
✗ box-shadow (utiliser un filet 1px --rule à la place)
✗ gradient, quel qu'il soit
✗ glassmorphism, backdrop-filter, blobs, formes décoratives flottantes
✗ emoji dans l'interface
✗ icônes décoratives (les icônes fonctionnelles sont autorisées, en trait 1.5px)
✗ hero avec « Hello, I'm … » ou une variante
✗ section entièrement composée de cartes
✗ barres de progression ou pourcentages de compétence
✗ bulle de chat flottante en bas à droite
✗ dark mode / toggle de thème
✗ Framer Motion, GSAP, ou toute bibliothèque d'animation JS
✗ plus d'une couleur d'accent visible par écran
✗ texte centré sur plus de deux lignes
✗ police système en fallback visible (préchargement obligatoire)
✗ animation en boucle infinie
✗ défilement détourné (scroll hijacking), défilement horizontal, curseur personnalisé
✗ compteur qui s'incrémente, effet machine à écrire
✗ placeholder utilisé à la place d'un label

OBLIGATOIRE :
✓ filets 1px comme unique séparateur
✓ mono pour tout chiffre, date, label, identifiant
✓ chaque section porte un numéro à deux chiffres en marge
✓ corps de texte plafonné à 68 caractères par ligne
✓ tout état interactif a un état :focus-visible distinct (contour vermillon 2px, offset 2px)
✓ prefers-reduced-motion respecté
✓ tout composant UI sous 150 lignes
```

---

## 9. Découpage des composants

Le sujet impose ~150 lignes max par composant. Exemple normatif pour la section `00` :

```
components/sections/opening/
├── Opening.tsx            // orchestration, Server Component, ~40 lignes
├── OpeningStatement.tsx   // la déclaration typographique + masque de révélation
├── OpeningMeta.tsx        // la ligne de métadonnées vivantes (lit le Profile)
└── OpeningRule.tsx        // le filet + le numéro de section

components/primitives/
├── SectionFrame.tsx       // la grille métadonnées | contenu — RÉUTILISÉE 6 FOIS
├── Rule.tsx               // filet horizontal ou vertical
├── Mono.tsx               // label mono, une seule source de vérité typographique
└── RevealLines.tsx        // primitive M1, wrapper de masque
```

`SectionFrame` est la pièce maîtresse : elle encode la grille asymétrique et la colonne de
métadonnées. Écris-la **en premier** et fais-la accepter `anchor="1-11" | "3-10" | …`.
Toutes les sections en découlent, et c'est ce qui garantit que Codex ne réinvente pas une
mise en page différente à chaque section.
