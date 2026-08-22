---
name: collision-proxy-authoring
description: Création des proxies de collision dans Blender — cuboid et convex hull plutôt que trimesh, hiérarchie de choix, règles de modélisation, détection automatique à l'import. Charger pour toute tâche touchant les meshes col_*.
---

# Proxies de collision

## Correction importante

Les versions précédentes du pack recommandaient le trimesh pour toute la
géométrie de niveau. **C'est le pire choix pour de l'architecture.**

Un trimesh est plus lent, numériquement moins stable, sujet aux ghost
collisions sur les arêtes internes, et sensible aux triangles longs et fins.
Or un niveau d'hypermarché est composé à 95 % de **boîtes**.

## Hiérarchie de choix

Dans l'ordre de préférence :

| Forme | Quand | Coût |
|---|---|---|
| **`cuboid`** | murs, sols, plafonds, gondoles, caisses, piliers | minimal |
| **`capsule` / `ball`** | poteaux ronds, objets arrondis | minimal |
| **`convexHull`** | rampes, formes convexes irrégulières | faible |
| **compound** (plusieurs cuboids) | forme concave décomposable | faible |
| **`trimesh`** | dernier recours, terrain irrégulier uniquement | élevé |

**Un cuboid n'a pas d'arêtes internes.** Le problème des ghost collisions
disparaît par construction, sans avoir besoin de `FIX_INTERNAL_EDGES`.

## Règles de modélisation

Un proxy `col_*` est **plus simple que la géométrie rendue**, toujours :

- Une gondole détaillée à 400 triangles → un `col_gondola` en boîte, 12 triangles
- Un escalier à marches → une **rampe inclinée** en boîte, pas les marches
  (l'autostep gère le reste, et la rampe supprime les accrochages)
- Une étagère avec des articles → une boîte englobante
- Ne jamais donner d'épaisseur nulle : minimum 0.1 m, sinon tunneling

Un proxy peut légèrement mentir sur la forme si ça améliore le déplacement.
C'est un outil de gameplay, pas une représentation fidèle.

## Convention

```
col_box_*      → détecté et émis en cuboid
col_hull_*     → convexHull
col_mesh_*     → trimesh + FIX_INTERNAL_EDGES (à justifier)
```

Le préfixe porte l'intention. Sans lui, l'import doit deviner, et deviner mal
coûte des heures de diagnostic.

## Détection automatique à l'import

Le loader peut reconnaître un cuboid sans annotation :

```ts
function tryCuboid(geo: THREE.BufferGeometry) {
  const pos = geo.attributes.position;
  if (pos.count !== 8 && pos.count !== 24) return null;   // 24 = normales dupliquées
  geo.computeBoundingBox();
  const b = geo.boundingBox!;
  const size = new THREE.Vector3().subVectors(b.max, b.min);
  // vérifier que chaque sommet est bien sur un coin de la boîte
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const onCorner =
      (Math.abs(v.x - b.min.x) < 1e-4 || Math.abs(v.x - b.max.x) < 1e-4) &&
      (Math.abs(v.y - b.min.y) < 1e-4 || Math.abs(v.y - b.max.y) < 1e-4) &&
      (Math.abs(v.z - b.min.z) < 1e-4 || Math.abs(v.z - b.max.z) < 1e-4);
    if (!onCorner) return null;
  }
  return RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2);
}
```

La rotation de l'objet est portée par le collider, pas par la forme : un mur en
biais reste un cuboid tourné.

## Diagnostic à produire

`level-forge` doit sortir, à chaque validation :

```
COLLIDERS
  cuboid      142   (91 %)
  convexHull    9   ( 6 %)
  trimesh       5   ( 3 %)   ← chacun justifié ?
  triangles totaux en trimesh : 2 840
  proxies à épaisseur < 0.1 m : 0
  proxies avec triangles fins (ratio > 20:1) : 0
```

Un pourcentage de trimesh qui monte est un signal : la géométrie de collision
dérive vers la géométrie de rendu, et les performances comme la stabilité vont
suivre.
