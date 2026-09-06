---
title: Three.js vanilla plutôt que Godot, Unity ou R3F
tags: [adr, architecture]
status: accepte
updated: 2026-09-05
---

# ADR 0001 — Three.js vanilla

## Statut

Accepté.

## Contexte

Prototype de boomer shooter par un développeur seul, senior TypeScript, sans
expérience Godot. Objectif : un niveau jouable de 8 à 10 minutes.

## Décision

Three.js vanilla, sans React Three Fiber pour la scène 3D. React reste présent
en overlay DOM pour le HUD.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Godot 4 | meilleur outillage de niveau, mais courbe d'apprentissage sur un projet à finir |
| Unity | scènes en YAML avec GUID de prefabs — hostile au diff git et à l'édition par agent |
| React Three Fiber | le modèle state → render → réconciliation est à l'opposé d'une boucle de jeu ; en pratique on finit par muter des refs dans `useFrame`, c'est-à-dire du Three.js vanilla avec un reconciler inutile par-dessus |

## Conséquences

- Le pipeline de niveau doit être construit à la main — c'est le point dur,
  voir [pipeline](../pipeline/niveau-blender.md)
- Pas d'éditeur de niveau intégré : Blender + conventions de nommage
- Le projet a de fortes chances d'être terminé, parce que c'est la stack
  familière du développeur — argument qui pèse plus que la technique sur un
  projet solo

## Comment on saurait qu'on a eu tort

Si le temps passé sur l'outillage de niveau dépasse le temps passé sur le
gameplay au moment d'atteindre la Phase 5.
