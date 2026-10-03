---
title: Ajouter un écran ou un widget
tags: [guide, recette]
status: brouillon
updated: 2026-10-02
---

# Ajouter un écran ou un widget

## Objectif

Ajouter un élément d'interface React qui respecte la séparation entre
simulation, store Zustand, composants et styles CSS.

## Avant de commencer

- Lisez les quatre règles React :
  [structure](../6-reference/react-structure.md), [bonnes
  pratiques](../6-reference/react-bonnes-pratiques.md),
  [CSS](../6-reference/react-css.md) et
  [composition](../6-reference/react-composition.md).
- Lisez [Interface React](../4-technique/interface-react.md) pour les
  flux de données et d'écran.
- Décidez si vous ajoutez un écran, une primitive réutilisable ou un
  widget du HUD.
- Consultez [Où agir](ou-agir.md) pour le store ou le flux d'écran
  existant.
- Vérifiez la version courante de la structure dans `src/ui/` ; les
  chemins de cette recette suivent la réorganisation actuelle.

## Étapes

1. Choisissez une famille par rôle : `src/ui/components/`,
   `src/ui/hud/widgets/` ou un sous-dossier de `src/ui/screens/`.
2. Créez un dossier par composant. Placez le JSX et le CSS Module côte à
   côte.
3. Exportez un composant nommé depuis le fichier nommé pareil. N'ajoutez
   pas de `index.ts`.
4. Définissez une interface de props dans le même fichier. Faites
   arriver les données par props si le composant est une primitive.
5. Composez par `children` ou par des emplacements JSX explicites. Le
   parent organise ; l'enfant affiche son contenu.
6. Créez le fichier `Composant.module.css`. Importez-le sous `styles` et
   utilisez ses classes.
7. Lisez les couleurs communes depuis `src/ui/theme/tokens.css`. Ajoutez
   un jeton sémantique uniquement s'il sert à plusieurs composants.
8. Pour une valeur calculée à l'affichage, passez une variable CSS avec
   `cssVars()` depuis `src/ui/lib/styleHelpers.ts`.
9. N'ajoutez pas d'état React pour une valeur connue du store ou une
   interaction CSS comme le survol.
10. Pour un widget de HUD, faites sélectionner au composant les seules
    valeurs qu'il affiche depuis `src/game/hud/state.ts`.
11. Le sélecteur Zustand doit retourner une primitive stable ou une
    valeur mémorisée par la même règle que le store ; ne construisez pas
    un objet neuf dans le sélecteur.
12. Gardez les composants de `components/` indépendants du store. Les
    écrans et widgets peuvent se connecter aux données d'état.
13. Pour un nouvel état de l'application, modifiez d'abord le store ou
    le pont de flux, pas le JSX qui tente de lire le moteur.
14. Si vous ajoutez un écran modal, raccordez-le au flux via les
    composants racines de `src/ui/App/App.tsx` et
    `src/app/navigation/gameFlowMachine.ts` selon son rôle.
15. Un écran ne décide pas du cycle de session. Les actions du moteur
    arrivent par des callbacks fournis par la couche appelante.
16. Gardez le réglage dans le module moteur concerné ; `src/ui/` ne
    devient pas propriétaire de persistance ou de logique de gameplay.
17. Si le composant sert au développement uniquement, placez-le dans
    `src/ui/dev/` et gardez toutes les branches d'usage derrière
    `import.meta.env.DEV`.
18. Ajoutez les fonctions pures testables à `test/ui/` en miroir du
    chemin de source. Pour le visuel, prévoyez une vérification DOM ou
    une capture.
19. Vérifiez l'accessibilité : libellés, boutons natifs, attributs ARIA
    pour les états et interactions clavier.
20. Ajoutez un lien à la page technique lorsque le nouveau widget fait
    évoluer un contrat durable.

## Vérifier

- Exécutez les tests UI concernés et le typecheck.
- Démarrez l'overlay et vérifiez sa position, ses interactions, le ton
  actif et les différents états.
- Regardez le HUD à 640×360 puis dans une fenêtre de dimensions
  différentes ; ses proportions suivent le pixel virtuel.
- Si le code appartient à `dev/`, inspectez aussi le build de production
  pour confirmer qu'il n'embarque aucun élément de développement.
- Vérifiez qu'aucun composant ne reçoit un state par frame et que les
  abonnements au HUD restent sous 10 Hz.
- Regardez les avertissements console et le DOM pour les noms
  accessibles et les états ARIA.

## Pièges

- Un parent qui lit tout le store force le HUD entier à se rendre lors
  de chaque changement.
- Un sélecteur qui renvoie un nouvel objet peut provoquer des rendus
  répétés sous Zustand 5.
- Une primitive qui lit le store ne peut plus être réutilisée dans un
  aperçu indépendant.
- Un import sans garde peut faire entrer le panneau de développement et
  son CSS dans le bundle.
- Le CSS inline casse les media queries et les états de focus ; utilisez
  les CSS Modules et `cssVars()`.
- Ne créez pas un dossier `lib/` pour un seul composant : gardez le
  module privé près de son seul consommateur.
- Un écran modal et un widget HUD n'ont pas le même comportement de
  souris ; vérifiez `pointer-events` selon la règle CSS.

## Exemple réel

Commit `bed303b`, « Interface : src/ui réécrit selon les conventions, un
dossier par composant » : l'interface est réorganisée par composants,
familles et responsabilités.
