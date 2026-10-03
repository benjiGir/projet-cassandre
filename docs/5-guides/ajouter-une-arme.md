---
title: Ajouter une arme
tags: [guide, recette]
status: brouillon
updated: 2026-09-26
---

# Ajouter une arme

## Objectif

Ajouter une arme utilisable par le joueur en reliant ses règles de
gameplay, son état, son input, ses effets, son modèle et ses cas de
vérification.

## Avant de commencer

- Lisez [Armes](../4-technique/armes.md), [Sprites et
  viewmodel](../4-technique/sprites-et-viewmodel.md) et
  [Contrôles](../6-reference/controles.md).
- Consultez les [valeurs de référence](../6-reference/valeurs-armes.md)
  avant de modifier les dégâts, cadence, portée ou munitions.
- Déterminez si l'arme est au contact, hitscan ou projectile et comment
  ses munitions sont gérées.
- Vérifiez que son ajout ne viole pas le contrat du pas fixe, du RNG ou
  l'absence de rechargement bloquant.
- Inspectez les unions et les événements de `src/game/player/weapons/weapons.ts`
  avant de décider des points d'extension.
- Prévoyez un son d'arme via [Ajouter un son](ajouter-un-son.md) et un
  modèle avec le pipeline d'assets si nécessaire.

## Étapes

1. Ajoutez ses paramètres à `src/game/player/weapons/weaponConfig.ts`. Chaque
   valeur a une seule source de vérité.
2. Étendez `WeaponKind` et `FiringWeapon` dans
   `src/game/player/weapons/weapons.ts`, ainsi que l'identifiant d'événement de
   tir si le nouveau type le demande.
3. Ajoutez le binding ou le comportement de sélection dans
   `src/core/input/input.ts` et la capture d'input dans
   `src/game/loop/updateGameplay.ts`.
4. Gardez la sélection accessible depuis l'arme active sans dupliquer la
   règle dans l'UI.
5. Implémentez le coût de tir, la cadence, les munitions, la portée et
   la résolution de collision dans le système d'arme au pas fixe.
6. Le rayon ou le projectile utilise les groupes de collision prévus et
   un RNG déterministe lorsqu'une dispersion est aléatoire.
7. Générez les événements de tir et de touche dans les types partagés
   utilisés par les systèmes de cibles et d'effets.
8. Ne lisez jamais une caméra ou une position interpolée pour décider un
   tir. Utilisez l'origine et l'orientation authentiques du pas fixe.
9. Branchez l'arme aux systèmes d'ennemis, props ou vitres en lisant la
   cible réellement touchée plutôt qu'en réimplémentant le raycast.
10. Ajoutez la séquence de tir et de recul au viewmodel dans
    `src/render/viewmodel/viewmodel.ts`.
11. Créez ou modifiez le modèle dans `tools/blender/build_weapons.py` et
    exportez-le vers `public/assets/weapons/` selon le format attendu
    par le loader.
12. Ajoutez l'asset de prise en main et, si demandé, le modèle au sol
    via `tools/blender/render_weapon_pickups.py`.
13. Ajoutez son identifiant de son au raccord entre jeu et studio audio
    dans `src/core/audio/audio.ts`.
14. Projetez l'arme et ses munitions dans `src/game/hud/state.ts` si le HUD
    les présente ; ne faites pas lire toute l'arme au parent du HUD.
15. Ajustez les libellés ou l'icône dans le composant de widget
    concerné, conformément aux quatre règles React.
16. Ajoutez des tests pour cooldown, tir à sec, sélection, collisions,
    cadence, recul et reset.
17. Mettez à jour les pages fonctionnelle, technique, référence et [Où
    agir](ou-agir.md).

## Vérifier

- Vérifiez tir, sélection, portée, dispersion, dégâts et limites de
  munitions dans une scène de test.
- Vérifiez que tir à sec ou cooldown n'immobilise jamais le joueur.
- Vérifiez le déterminisme en rejouant une même séquence et inspectez
  les événements de hit.
- Contrôlez le modèle à la taille d'écran du jeu, pas uniquement en vue
  rapprochée Blender.
- Vérifiez le build asset, le manifeste sonore et l'affichage HUD si
  l'arme touche à ces canaux.
- Lancez les tests d'arme puis le typecheck et le build selon l'étendue
  du changement.

## Pièges

- Une nouvelle arme ajoutée à l'union doit apparaître dans chaque switch
  exhaustif ; laissez TypeScript repérer les oublis.
- Dupliquer le raycast dans l'arme ou un effet peut produire deux
  résultats de collision différents.
- Un tir résolu hors du pas fixe rend le rejeu dépendant du framerate.
- Une dispersion calculée par `Math.random()` casse la continuité des
  séquences.
- L'arme doit être explicitement possédée si le niveau démarre désarmé.
- Ne faites pas d'animation de rechargement qui bloque mouvement ou
  input.
- Les armes au sol ont un contrat de préfixe historique et leur
  ramassage est automatique ; voyez la référence glTF.

## Exemple réel

Commit `d8dbf40`, « Armes et feel de tir (Phase 2) + wireframe debug +
fix stutter déplacement » : il ajoute la première implémentation du
pied-de-biche et du pompe, les paramètres d'arme, les événements de tir
et le viewmodel.
