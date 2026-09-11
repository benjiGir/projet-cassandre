---
title: Fusion du décor statique au chargement plutôt qu'instanciation GPU
tags: [adr, rendu, pipeline, niveau]
status: accepte
updated: 2026-09-11
---

# ADR 0023 — Fusion du décor statique au chargement plutôt qu'instanciation GPU

## Statut

Accepté (jalon N1 de `PLAN_NIVEAU_V2.md`).

## Contexte

Le niveau v2 doit être 5 à 10 fois plus fourni que `hypermarche_complet`,
sur un matériel cible modeste (portable à GPU intégré). Or le loader
rendait chaque mesh de décor séparément : mesuré au point de départ de
`hypermarche_complet`, 615 meshes de décor donnaient **513 draw calls** —
three.js n'élimine que ce qui sort du champ, pas ce qui est caché derrière
un mur, donc presque tout le niveau est dessiné à chaque image.

Deux contraintes existantes pèsent sur la solution :

- **Le piège instancing-vs-bake** ([Niveau : Blender vers
  glTF](../pipeline/niveau-blender.md#piège-instancing-vs-bake)) : chaque
  objet rendu porte sa propre géométrie pour recevoir son propre éclairage
  baké en vertex colors. Des instances partagent leur géométrie, donc leurs
  vertex colors.
- **`toLambert` crée un matériau par mesh** : même texture, instances
  distinctes.

## Décision

Au chargement (`game/level/mergeStaticDecor.ts`, appelé en fin de
`buildLevelResourceEffect`), les meshes de décor statiques sont regroupés
par contenu de matériau et par jeu d'attributs, puis **fusionnés** en un
mesh par groupe (`BufferGeometryUtils.mergeGeometries`). Chaque objet garde
ses propres sommets et donc son propre bake. Les objets qui bougent ou
doivent rester adressables (portes, objets interactifs, cibles
d'animation, colliders et volumes logiques) ne sont jamais fusionnés.

Résultat mesuré sur `hypermarche_complet` : 615 meshes → 5 lots, **513 → 25
draw calls**, temps de rendu CPU 1,40 → 0,70 ms, statistiques du niveau
inchangées. Budget retenu pour le niveau v2 : **200 draw calls au plus**
par image, et le plafond existant de 200 000 triangles.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Instanciation GPU (`EXT_mesh_gpu_instancing` → `InstancedMesh`) | les instances partagent leur géométrie donc leur bake ; il aurait fallu approximer l'éclairage par une teinte par instance. Inutile tant que la fusion suffit |
| `BatchedMesh` | apporte un culling par objet et des mises à jour par objet dont un décor figé n'a pas besoin, pour une API plus lourde à brancher dans le cycle de vie du niveau |
| Fusionner dans Blender avant export | fige la fusion dans le fichier source, casse la lecture objet par objet du niveau et du hot reload, et oblige à refaire le bake à chaque changement de regroupement |
| Garder les meshes individuels | 513 draw calls pour le niveau actuel ; un niveau 5 à 10 fois plus fourni dépasserait largement le budget d'un GPU intégré |

## Conséquences

- Un lot est dessiné en entier dès qu'une de ses parties est dans le champ :
  46 746 → 55 678 triangles sur la même vue. Négligeable aujourd'hui.
- Le nombre de draw calls du décor suit désormais le **nombre de matériaux
  distincts**, pas le nombre d'objets : la palette et les atlas partagés du
  niveau v2 (voir [Harmonisation des
  assets](../pipeline/harmonisation-assets.md)) deviennent aussi un levier de
  performance.
- Les meshes à échelle négative restent individuels (inversion de l'ordre
  des sommets) ; un asset importé en miroir coûte donc un draw call de plus.
- `LevelStats.decorBatchCount` expose le nombre d'objets de décor rendus ;
  `DebugPanel` affiche les draw calls et triangles de chaque image.

## Comment on saurait qu'on a eu tort

Si le niveau v2 approche du plafond de triangles parce que des lots entiers
sont dessinés pour une petite partie visible, découper les lots par cellule
spatiale. Si la mémoire ou le temps de chargement explosent parce que des
milliers de copies du même produit sont fusionnées, basculer ces produits
(et eux seulement) en `InstancedMesh`, en acceptant l'éclairage par teinte
d'instance.
