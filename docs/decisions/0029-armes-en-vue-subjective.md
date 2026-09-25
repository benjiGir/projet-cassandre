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

## Révision du 2026-09-25 — refonte du modèle du pistolet

Retour de l'utilisateur, mot pour mot : « Refaire le modèle du pistolet,
parce qu'il est vraiment horrible. » Diagnostic chiffré et modèle de
remplacement écrits dans
[`docs/assets/board-pistolet.md`](../assets/board-pistolet.md) avant toute
retouche du script (`reference-driven-authoring`) : le pistolet d'origine
avait un rapport hauteur/longueur de 1,01 (un Beretta fait 0,63, un Glock
0,68), une poignée-tube qui flottait sous la carcasse, un canon-clou de
3,5 cm, et surtout une CULASSE PLUS SOMBRE que la carcasse — l'inverse de ce
que dit le commentaire du code d'origine, et l'inverse de ce qu'exige la
lisibilité sous l'éclairage très faible de la vue subjective (0,06 à 0,18 de
la lumière de la scène, mesuré).

`construire_pistolet` (`tools/blender/build_weapons.py`) est réécrite
d'après ce board : Beretta 92FS deux tons (culasse inox, carcasse noire),
raccourci vers le gabarit du 92 Compact, dessus de culasse ouvert (le canon
visible entre deux rails, la vraie signature d'un Beretta vu de dos), hausse,
guidon, chien, leviers de sûreté, pontet ajouré. 350-420 triangles (mesuré :
360 pour le modèle au sol), contre 108 avant — le budget n'était pas le
problème, la forme l'était. `PRISE_PISTOLET` et le nouveau `bout_canon`
(`BOUT_CANON_PISTOLET`) ont été recalés en conséquence ; pied-de-biche et
pompe n'ont pas été touchés (vérifié par comparaison des comptes de sommets/
triangles avant/après, identiques). Détail dans
`tools/blender/README.md#pistolet--refonte-2026-09-25`.

**Ce qui reste hors de portée de ce modèle, chiffré dans le board** :
l'éclairage de la vue subjective écrase toute palette (même un blanc pur
n'y dépasse pas `#38`-`#61` à l'écran, mesuré par approximation d'exposition
faute d'outil de capture en jeu pour cet agent) — un sujet de rendu
(`retro-render`), pas de modèle. **En attente du verdict de playtest.**
