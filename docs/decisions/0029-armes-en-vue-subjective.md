---
title: Armes en vue subjective — modèles 3D tenus par des bras CC0
tags: [adr, rendu, armes, assets]
status: accepte
updated: 2026-09-13
---

# ADR 0029 — Armes en vue subjective : modèles 3D tenus par des bras CC0

## Contexte

Après les Costards animés ([ADR 0028](0028-sprites-ennemis-pre-rendus.md)),
l'arme à l'écran restait la boîte de la Phase 2 : un pavé brun pour le
pied-de-biche, un pavé gris pour la pompe. Demande de l'utilisateur : « un pied
de biche et une pompe pour le joueur ». Trois choix, tranchés par lui : le mode
de rendu, la présence des mains, et le périmètre (ramassages au sol et
animation de changement d'arme inclus).

## Décision

**Des modèles 3D basse définition accrochés à la caméra**, pas des sprites 2D.
Le pied-de-biche et la pompe sont construits par code
(`tools/blender/build_weapons.py`) ; les **avant-bras et les mains viennent du
« Man in Long Sleeves » CC0 de Quaternius**, même squelette que le Costard,
posés sur les poignées par IK. L'ensemble est exporté dans le repère de l'œil :
la composition de l'écran se règle dans Blender, le jeu n'ajoute que le
mouvement.

Les gestes (balayage, pompage, changement d'arme) sont procéduraux, pilotés par
des horloges avancées au pas fixe et lues par le rendu seul.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| **Sprites 2D pré-rendus** (Duke 3D, Ion Fury) | Plus fidèle au look Build, mais animé par à-coups, et le recul validé en jouant (`RECOIL_VARIANTS`) aurait été à refaire en décalages 2D |
| **Arme seule, sans mains** | Plus rapide, moins vivant ; les mains font le charme du genre |
| **Mains modélisées par code** | Des moufles ; le modèle CC0 a des doigts qui se referment |
| **Animations squelettiques exportées** | Un `AnimationMixer` par arme pour trois gestes qui tiennent chacun en une courbe ; le procédural se règle à chaud |
| **Seconde passe de rendu pour passer devant les murs** | Il faudrait dupliquer toutes les lampes sur une couche dédiée ; `gl.depthRange` sur les seuls meshes d'arme suffit |

## Conséquences

- **Les bras trichent** : gabarit de 2,2 m au lieu de 1,8 m. À la taille
  réelle, un bras de 56 cm n'atteint pas le fût d'une pompe posée dans le champ
  — tous les viewmodels trichent ainsi, et des mains plus grandes se lisent
  mieux à 640×360.
- **Les armes sont éclairées par le niveau** (Lambert, lampes voisines) : elles
  s'assombrissent dans un recoin sombre, comme le reste.
- **Trois lots de dessin au plus** pour le viewmodel (un par pied-de-biche,
  deux pour la pompe), un par ramassage visible.
- **L'éclair de tir du pompe naît au bout du canon affiché**, plus au centre de
  l'écran.

## Comment on saurait qu'on a eu tort

- Si l'arme gêne la visée, c'est le placement (`PRISE_*`, `AXE_*` du script
  Blender) qu'il faut revoir, pas l'échelle en TypeScript.
- Si le balayage paraît mou ou illisible en jouant, ce sont les amplitudes
  (`SWING_*`, `render/viewmodel.ts`) et `VIEWMODEL_TIMING.strike` qui se
  règlent — pas un retour à un sprite.
