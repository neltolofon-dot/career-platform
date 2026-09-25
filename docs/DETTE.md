# Dette technique connue

Ce qui est su, mesuré et pas encore corrigé. Chaque entrée dit ce qu'on a mesuré, ce
qu'on a vérifié et ce qui reste une hypothèse.

---

## DT-01 — Décalage de mise en page de 0,006 au premier écran

**Ouverte le 25/09/2026.**

| | |
|---|---|
| Mesure | CLS **0,006** (0,005 à 0,007) sur l'accueil, Lighthouse mobile en local |
| Élément | `div.opening__actions`, la rangée de boutons « Voir mes projets » / « Me contacter » |
| Fréquence | 8 passages sur 11 avant le bloc 16 ; même valeur après |
| Antériorité | **Antérieur au bloc 16.** Présent au commit `4b3e400`, mesuré en alternance avec la nouvelle version, même élément, même valeur |
| Cause | **Non vérifiée.** Hypothèse : le chargement des polices. Un changement de métrique entre la police de repli et la police finale modifierait la hauteur du titre et du paragraphe au-dessus des boutons, qui descendraient alors de quelques pixels |
| Seuil | Sous le seuil « bon » de Google (0,1) ; la page ne saute pas à l'œil. C'est une dette parce que la documentation annonçait 0 |

**Ce que ce n'est pas.** Ce n'est pas le portrait : il est placé après les boutons dans
le DOM et son espace est réservé (`width`/`height` du fichier + `aspect-ratio`). Ce n'est
pas non plus la couche mouvement : la valeur est la même sans elle.

**Pour trancher.** Enregistrer une trace dans l'onglet Performance des DevTools, avec le
réseau ralenti, puis lire les sources du décalage (`previousRect` / `currentRect`). Les
comparer au moment où les polices se chargent (`document.fonts.ready`). Si c'est
confirmé, il faut rapprocher les métriques de la police de repli de celles de la police
finale (`size-adjust`, `adjustFontFallback` de `next/font`), ou précharger la police du
titre.

**Pas reproduit hors Lighthouse** : aucun décalage mesuré sur 3 chargements Playwright non
ralentis. Le décalage dépend donc de l'ordre d'arrivée des ressources, ce qui va dans le
sens de l'hypothèse des polices sans la prouver.
