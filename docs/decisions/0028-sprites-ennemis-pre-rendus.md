---
title: Sprites d'ennemis pré-rendus depuis un modèle 3D CC0
tags: [adr, rendu, entites, assets]
status: accepte
updated: 2026-09-13
---

# ADR 0028 — Sprites d'ennemis pré-rendus depuis un modèle 3D CC0

## Contexte

Le niveau v2 est habillé de bout en bout, mais les ennemis restaient l'atlas
numéroté de la Phase 3 : un rectangle de couleur portant « 2.3 », une pose
figée par état. Demande de l'utilisateur : « je veux voir des vrais costards
bouger ».

Deux questions étaient ouvertes, toutes deux tranchées par l'utilisateur :
comment afficher un ennemi, et d'où vient le personnage.

## Décision

**Des sprites 8 directions pré-rendus**, à la manière de Duke 3D et de Blood :
un modèle 3D animé est rendu dans Blender depuis huit angles, frame par frame,
réduit en pixels francs et quantifié sur 48 couleurs, puis assemblé en atlas.
En jeu, rien ne change de nature : un quad Lambert yaw-only (`BillboardSprite`),
une case d'atlas par frame.

**Le personnage est le « Man in Suit » CC0 de Quaternius** (registre
`assets_src/LICENCES_ASSETS.md`) : rigué, 11 animations, dont une course et
une mort utilisables telles quelles. Ce qui lui manque est construit par
script (`tools/blender/render_enemy_sprites.py`) : pistolet, cravate, lunettes
noires, poses de visée et de tir, peau reptilienne du Directeur.

Le manifeste JSON écrit à côté de l'atlas dit quelle ligne porte quelle
animation. Le jeu le lit au démarrage : changer le nombre de frames d'une
animation ne demande que de relancer le script.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| **Vrais modèles 3D skinnés en jeu** | Plus fluides, mais on sort du look Build : le reste du jeu est pensé pour des sprites, et 40 squelettes animés dans le niveau v2 coûtent du CPU par frame là où un sprite coûte un offset d'UV |
| **Personnage généré par code dans Blender** | Contrôle total et zéro téléchargement, mais risque réel d'un look mannequin, et des animations procédurales raides pour la course et la chute |
| **Sprites dessinés à la main** | Le look d'origine des jeux Build, hors de portée : huit directions × vingt frames × trois peaux |
| **Miroir des directions 5-7** (l'astuce de Doom) | Divise l'atlas par deux, mais fait passer le pistolet de main quand l'ennemi tourne |

## Conséquences

- **La télégraphie du tir se lit de face.** Un bras seul tendu vers la caméra
  se raccourcit jusqu'à disparaître : la visée est une prise à deux mains,
  dont les manches noires croisent la chemise blanche.
- **La course est entraînée par la distance parcourue**, pas par le temps : un
  Costard bloqué contre un mur cesse de courir. Les horloges d'animation
  avancent au pas fixe (hitstop compris) mais aucune décision ne les lit.
- **Chaque ennemi visible reste un lot de dessin.** C'était déjà le cas avec
  l'atlas numéroté ; le budget du niveau v2 (186 sur 200) rend un
  `InstancedMesh` probable si les combats de foule s'en approchent.
- Atlas de 1920 × 3840 px à 96 px/m : ~39 Mo de mémoire vidéo chacun,
  mipmaps comprises, trois atlas en tout (~118 Mo), et 1,6 Mo de PNG chacun.
  Les clones par instance partagent la même texture GPU (même `Source`).

## Révision du 2026-09-14 : lisibilité

Retour après les premiers essais : « leur rendu est trop low res ». Mesuré en
jeu, ce n'était ni le filtrage (`nearest` et `aniso` donnent la même image) ni,
au-delà de 3 m, la densité de l'atlas : **c'est le budget de pixels de l'écran**.
À 11 m, un Costard fait 38 px de haut sur 360. Le modèle Quaternius, élancé,
en veste presque noire et visage sombre, n'y laissait qu'un bâton brun, et
dans le parking du niveau v2 une silhouette noire.

La résolution interne n'a pas bougé (invariant #4). Ont changé :

| Levier | Avant | Après | Pourquoi |
|---|---|---|---|
| Membres | tels quels | +1,8 cm le long des normales | un avant-bras couvre enfin un pixel à 12 m |
| Tête | ×1 | ×1,22 | c'est la tête (lunettes) qui dit « Costard » ; Doom et Duke 3D trichent pareil |
| Veste | `#2e2e38` | `#44475a` | un noir se confond avec toutes les ombres du niveau |
| Plastron, visage | gris, brun foncé | blanc franc, visage plus clair | les lunettes se découpent sur le visage |
| Lunettes, cravate | fines | plus larges que nature | deux pixels à 10 m |
| Reflet spéculaire | actif | coupé | il grisait les lunettes vues de face |
| Densité | 64 px/m | 96 px/m | au corps à corps, l'atlas s'agrandissait 2,4 fois |
| Normales du quad | vers la caméra | inclinées de 45° vers le haut | les néons du plafond éclairaient le quad à l'horizontale |

## Comment on saurait qu'on a eu tort

- Si les Costards disparaissent encore dans les zones sombres, l'inclinaison
  des normales (`ENEMY_SPRITE_NORMAL_TILT`) ne suffit plus : il leur manque
  l'éclairage indirect que les murs reçoivent par le bake. La piste suivante
  est un plancher d'éclairage propre aux sprites (`lightMap` blanc 1 × 1,
  toujours Lambert), pas une veste plus claire.
- Si les frames sautent de façon visible en poursuite, c'est `metersPerCycle`
  du manifeste qui ne colle plus à `chaseSpeed`, pas le nombre de frames.
