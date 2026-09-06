---
title: Colliders cuboid plutôt que trimesh
tags: [adr, physique]
status: accepte
updated: 2026-09-05
---

# ADR 0004 — Cuboid d'abord, trimesh en dernier

## Statut

Accepté. Corrige une recommandation initiale erronée en faveur du trimesh.

## Contexte

Un niveau d'hypermarché est composé à 95 % de boîtes. Le réflexe initial était
d'émettre un collider trimesh pour toute géométrie `col_*`.

Un trimesh est plus lent, numériquement moins stable, sensible aux triangles
longs et fins, et sujet aux **ghost collisions** sur les arêtes internes entre
triangles coplanaires — le classique « je me bloque sur un sol parfaitement
plat », qui se diagnostique à tort comme un bug de character controller.

## Décision

Hiérarchie à l'import : `cuboid` → `capsule`/`ball` → `convexHull` → compound →
`trimesh` en dernier recours.

Quand le trimesh est inévitable, `TriMeshFlags.FIX_INTERNAL_EDGES` est
obligatoire.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Trimesh partout | ghost collisions, coût, instabilité |
| Convex decomposition automatique | complexité disproportionnée au stade prototype |

## Conséquences

- Un cuboid n'a pas d'arêtes internes : le problème disparaît par construction
- Les proxies `col_*` sont modélisés à part, plus simples que le rendu
- Un escalier a une **rampe** pour proxy, pas ses marches — l'autostep gère
- Le loader journalise la répartition cuboid / hull / trimesh à chaque
  chargement

## Comment on saurait qu'on a eu tort

Si la proportion de trimesh dépasse 15 % : la géométrie de collision dérive
vers la géométrie de rendu.
