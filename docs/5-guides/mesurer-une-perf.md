---
title: Mesurer une performance
tags: [guide, recette]
status: brouillon
updated: 2026-09-26
---

# Mesurer une performance

## Objectif

Mesurer le coût de rendu ou de simulation dans une scène et une caméra
reproductibles, puis localiser le poste responsable avant de modifier le
budget.

## Avant de commencer

- Lisez [Budget de rendu](../4-technique/budget-de-rendu.md),
  [Rendu](../4-technique/rendu.md) et [Tests et
  qualité](../4-technique/tests-et-qualite.md).
- Choisissez un protocole : position du joueur, orientation, niveau,
  nombre d'ennemis, état des lampes et résolution.
- Vérifiez le build et le navigateur ; ne comparez pas un build dev et
  un build production sans l'indiquer.
- Identifiez la mesure : temps CPU de rendu, frame time, lots de dessin,
  triangles, ombres ou simulation.
- Le seuil historique de lots du niveau n'est pas un budget universel
  pour chaque caméra.

## Étapes

1. Fixez une scène et attendez la fin de son chargement avant de
   mesurer.
2. Placez la caméra au point de référence. Utilisez la même pose et le
   même FOV pour chaque essai.
3. Répétez la mesure avec `cassandre.renderBench(frames)` ; par défaut
   le harnais échantillonne 120 images.
4. Notez le rapport complet, pas seulement sa moyenne : identifiez
   percentiles et métriques exposés par le benchmark.
5. Mesurez plusieurs angles de vue et positions à l'intérieur du niveau.
6. Relevez le nombre de lots et de triangles rendu depuis le moteur ou
   la console du navigateur.
7. Utilisez `cassandre.lightBudget()` pour lire le pool de lampes sans
   le modifier.
8. Changez un paramètre à la fois. `cassandre.lightBudget(n)` applique
   un budget ; `null` rallume tout pour un diagnostic contrôlé.
9. Si la scène ne contient pas de pool de lampes, gardez la distinction
   entre rapport du pool et balayage de la scène.
10. Pour isoler les textures ou l'éclairage, utilisez
    `cassandre.lighting()` et l'API `cassandre.filtrage(...)`.
11. Vérifiez la scène dans le build qui correspond au niveau cible. Les
    assets et branches dev changent le coût.
12. Mesurez une base avant le changement et le même protocole après.
13. Consignez machine, navigateur, build, résolution, position, nombre
    de répétitions et état de l'onglet si pertinent.
14. Pour un niveau Blender, les lots de décor se contrôlent à plusieurs
    positions et suivent les cellules de fusion ; consultez le budget de
    rendu.
15. Recherchez le poste concret : objet visible, lampe active, matière
    qui empêche la fusion, objet non élagué ou lot de widget.
16. Élaborez un changement local et contrôlez les vues voisines. Une vue
    optimisée peut dégrader une autre.
17. Demandez une vérification `qa-evidence` avant de conclure sur une
    amélioration destinée au joueur.
18. Mettez à jour le budget documenté si une contrainte mesurée change
    durablement.

## Vérifier

- Le protocole exact est répété avant et après le changement.
- Plusieurs positions de caméra incluent la pire vue, pas seulement le
  spawn.
- La modification améliore la métrique ciblée sans faire dépasser une
  autre contrainte.
- La preuve conserve les captures, le résultat de la console et la
  révision du code.
- Le résultat est interprété dans le contexte du GPU/CPU réellement
  testé.

## Pièges

- `renderBench` isole le coût du rendu et n'est pas un benchmark complet
  du navigateur ou du gameplay.
- Un seul point de vue sous-estime les lots d'un niveau.
- Un test en dev inclut des outils qui peuvent être absents de
  production.
- Le pool de lampes signale le choix de lampes actives, pas le coût
  total des shaders.
- Ne confondez pas un nombre de lots et un temps d'image stable.
- Un test automatisé peut brider `requestAnimationFrame` ; le harnais
  hors boucle sert précisément à éviter cette mesure invalide.
- Ne supprimez pas l'élagage de frustum pour faire disparaître un défaut
  de visibilité : cela peut ajouter un lot à toutes les vues.

## Exemple réel

Commit `6e3b0e3`, « Budget de rendu : mesuré, pas supposé — le mur est
dans les lampes » : il ajoute un harnais de benchmark, un rapport de
budget et le pool de visibilité par espace.
