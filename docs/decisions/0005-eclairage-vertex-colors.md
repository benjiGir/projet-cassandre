---
title: Éclairage baké en vertex colors
tags: [adr, rendu, pipeline]
status: accepte
updated: 2026-09-05
---

# ADR 0005 — Vertex colors plutôt que lightmap

## Statut

Accepté.

## Contexte

Un niveau Build est éclairé par secteur, baké dans la géométrie. Il faut un
équivalent pour un rendu `MeshLambertMaterial` affiché en 640×360.

## Décision

Bake d'éclairage Cycles en **vertex colors** (`COLOR_0`), pas en lightmap.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Lightmap | plusieurs Mo pour une résolution perdue avant d'être vue à 640×360 |
| Éclairage dynamique | coût sans contrepartie, et hors registre visuel |
| Aucun éclairage baké | rendu plat, le Lambert seul ne donne pas la sensation d'espace clos |

## Conséquences

- **Contrainte forte** : une face doit être subdivisée pour recevoir le bake.
  Un mur en 2 triangles a 4 sommets et ne peut rien recevoir. La subdivision au
  mètre devient une propriété du kit modulaire, pas une correction après coup.
- Plus de triangles, zéro texture, zéro draw call supplémentaire
- L'éclairage est statique : muzzle flash et gyrophares restent dynamiques,
  deux à trois `PointLight` maximum en simultané
- Piège de colorspace : glTF stocke `COLOR_0` en linéaire et le multiplie à la
  couleur de base

## Comment on saurait qu'on a eu tort

Si le budget de triangles est atteint par la subdivision d'éclairage avant que
le niveau soit complet.
