---
title: Fours du fournil
tags: [assets, blender, magasin]
status: stable
updated: 2026-10-12
---

# Fours du fournil

## Objectif et référence

Le retour sur la [passe des ateliers](../5-guides/direction-artistique.md) demande
des fours reconnaissables. L’ancienne façade ressemble à une armoire de six
mètres avec de petits rectangles orange.

La référence est le [four à soles Orion EvO de Bongard](https://www.bongard.fr/produit/four-a-soles-orion-evo/),
avec sa [photo constructeur](https://www.bongard.fr/wp-content/uploads/2018/12/four-a-sole-orionevo.jpg).
L’adaptation retient les chambres superposées, les larges vitres, les montants
inox, les poignées, la commande latérale et la hotte. Elle ne reproduit ni
le logo ni le modèle exact.

## Appareils proposés

- Deux modules de 2,82 m, à quatre étages, avec deux vitres par étage.
- Chambres réellement creuses, soles réfractaires et pains visibles.
- Portes vitrées à cadre sombre, poignées et commandes par étage.
- Hottes inclinées et conduits raccordés au plafond.
- Rôtissoire plus haute, avec deux portes vitrées, trois broches et un socle.

Le métal réutilise les textures d’inox et de noir des ateliers. Les petites
commandes et les aliments utilisent la palette existante. Le vitrage reste
transparent à 30 %, avec `solide: false` ; le volume de l’appareil fournit
la collision. Les vitrages et portes des fours sont fixes.

## Intégration et reprise

`tools/blender/lib_fournil_ovens.py` construit les deux appareils et leurs
trois proxies. `tools/level_v2/espaces/fournil.py` appelle cette bibliothèque
pendant le build normal. `tools/art_direction/store_workshops.py` connaît
leurs familles de matériaux.

La retouche locale retire les anciennes composantes des fours dans les
meshes partagés, puis reconstruit les appareils. Les tables, chariots,
chambre de pousse, nourriture ramassable et lampes restent en place.

```sh
blender -b assets_src/blender/niveau_v2.blend \
  -P tools/blender/cassandre_cli.py -- rework_fournil_ovens
```

La copie avant retouche reste dans
`renders/_cassandre/niveau_v2_avant_fours.blend`, lorsqu'elle existe localement.
Le relevé est écrit dans `renders/reviews/fours-fournil/deploiement.json`.

## Revoir dans le jeu

Rejoindre le fournil du magasin. Observer les pains derrière les larges
vitres des fours à soles et les broches de la rôtissoire. Workbench affiche
le vitrage opaque et sert uniquement à lire les proportions.

Le rendu a été approuvé par l'utilisateur le 11 octobre 2026. Les captures
comparatives et la page de revue ont été retirées après validation.
