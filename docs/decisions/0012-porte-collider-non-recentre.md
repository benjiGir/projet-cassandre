---
title: Collider de porte non recentré automatiquement dans loader.ts
tags: [adr, pipeline, physique]
status: accepte
updated: 2026-09-05
---

# ADR 0012 — Collider de porte non recentré automatiquement dans loader.ts

## Statut

Accepté.

## Contexte

`buildCuboidCollider` (`col_box_*`) et `buildTriggerEffect` (`trig_*`)
décomposent tous les deux la bounding box LOCALE du mesh pour calculer un
CENTRE (`localCenter`), puis positionnent le corps Rapier sur ce centre
transformé en espace monde — ce qui rend le collider correct même si
l'origine (le pivot) du mesh Blender n'est pas au milieu de sa géométrie.

`buildDoor` (`door_*`) ne fait PAS ça : il calcule bien une taille locale
(`localSize`, pour `halfExtents`) via la bounding box, mais positionne le
corps sur `worldPosition` — la translation MONDE BRUTE du mesh, obtenue par
`matrixWorld.decompose()`, jamais recentrée. Si le pivot Blender du mesh
n'est pas au centre de sa géométrie, le collider et le mesh visible
divergent.

Ce piège s'est concrétisé pendant la construction de la porte à badge de la
Zone E : `kit_door_leaf` (la pièce de vantail du kit modulaire) a une
origine-coin standard, comme la majorité des pièces du kit. Posée telle
quelle en niveau, son collider aurait été décalé de moitié de sa largeur par
rapport au vantail visible.

## Décision

Le recentrage a été fait côté Blender, sur la COPIE du mesh posée dans le
niveau (pas sur le datablock du kit lui-même, qui reste inchangé pour tout
autre usage) — pas dans `loader.ts`. `buildDoor` reste inchangé : il
continue de faire confiance à la translation brute du mesh.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Faire décomposer `buildDoor` la bounding box locale comme `buildCuboidCollider`/`buildTrigger` | changerait le comportement de TOUT `door_*` déjà exporté, y compris un futur vantail dont le pivot serait déjà intentionnellement au centre — une régression géométrique silencieuse sur du contenu existant, sans aucun test de non-régression géométrique automatisé sur les niveaux pour la détecter |
| Ne rien corriger nulle part | testé et refusé : le collider de `door_e_exit` aurait été visiblement décalé du vantail en jeu |

## Conséquences

- Chaque nouveau `door_*` posé en niveau doit avoir son pivot déjà centré
  sur sa géométrie — ce n'est PAS automatique, contrairement à `col_box_*`/
  `trig_*`. C'est une discipline manuelle côté Blender, pas une garantie du
  loader.
- `buildDoor` reste plus simple (une décomposition de moins) au prix de
  cette asymétrie avec les deux autres constructeurs de collider par
  bounding box — asymétrie invisible tant qu'on ne compare pas les trois
  fonctions côte à côte, donc un piège pour un futur lecteur du fichier.

## Comment on saurait qu'on a eu tort

Si un futur `door_*` réimporté produit un collider visiblement décalé de son
vantail en jeu, c'est le signal que la discipline manuelle côté Blender a
été oubliée. À ce moment, reconsidérer l'alignement de `buildDoor` sur le
même patron de décomposition que `buildCuboidCollider`/`buildTrigger` —
et revalider chaque niveau déjà exporté avant de le déployer, puisque ce
changement affecterait tous les `door_*` existants d'un coup.
