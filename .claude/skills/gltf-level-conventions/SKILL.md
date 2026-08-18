---
name: gltf-level-conventions
description: Pipeline Blender vers Three.js — conventions de nommage glTF, extraction des colliders trimesh Rapier, triggers, objets interactifs, hot reload. Charger pour toute tâche de chargement ou de structure de niveau.
---

# Pipeline de niveau glTF

## Le contrat de nommage

| Préfixe | Effet |
|---|---|
| `col_*` | collider trimesh statique, mesh rendu invisible |
| `spawn_player` | position + orientation de départ (Empty) |
| `spawn_suit_*` | point d'apparition ennemi (Empty) |
| `trig_*` | volume de trigger, box, sensor Rapier, mesh invisible |
| `door_*` | porte animée, collider dynamique |
| `use_*` | objet interactif, portée d'usage 2 m |
| `secret_*` | zone comptée dans le compteur de secrets |

Un mesh sans préfixe est rendu tel quel, **sans collider**, silencieusement.
C'est le comportement par défaut voulu : le décor non-collidable est la
majorité des objets, et un warning par mesh rendrait la console inutilisable.

## Avertissements bruyants

En revanche, signaler fort :
- `col_*` sans géométrie valide ou avec 0 triangle
- `spawn_player` absent ou en double
- `trig_*` qui n'est pas une box
- `use_*` sans cible référencée dans les `extras`
- collider dépassant 50 k triangles (signe d'un mesh oublié en high-poly)

## Extraction

```ts
gltf.scene.traverse((obj) => {
  if (!(obj instanceof THREE.Mesh)) return;

  if (obj.name.startsWith('col_')) {
    const geo = obj.geometry;
    const verts = geo.attributes.position.array as Float32Array;
    const idx = geo.index!.array as Uint32Array;
    world.createCollider(
      RAPIER.ColliderDesc.trimesh(verts, idx)
        .setCollisionGroups(GROUPS.WORLD),
      /* body statique */
    );
    obj.visible = false;
  }
});
```

Applique les transforms monde avant de passer les vertices à Rapier :
`obj.updateWorldMatrix(true, false)` puis `geo.clone().applyMatrix4(obj.matrixWorld)`.
Oublier ça donne un niveau où les collisions sont décalées d'un offset
constant — symptôme classique et facile à mal diagnostiquer.

## Métadonnées Blender

Les custom properties Blender arrivent dans `mesh.userData` via les `extras`
glTF. C'est le canal pour tout ce qui est paramétrable côté level design :
cible d'un `use_*`, PV d'une porte, son associé, ID de secret.

Export : cocher « Custom Properties » dans les options glTF.

## Hot reload

Watcher sur le `.glb`, rechargement de la scène sans redémarrer l'app.
**Préserve la position du joueur** quand c'est possible : respawner au début
à chaque itération rend le tuning de niveau pénible et allonge la boucle bien
au-delà des 60 s cibles.

## Critère de validation

Déplacer un mur dans Blender, exporter, le voir en jeu **en moins de
60 secondes**. Chronométré réellement.

C'est le livrable principal de ce pipeline. S'il n'est pas atteint, le reste
du travail sur le niveau sera pénible pendant tout le projet.

## Rollback

Si le pipeline glTF déborde au-delà d'un week-end, basculer sur TrenchBroom +
un parser `.map` (~300 lignes, format texte simple, brushes convexes). Décision
à remonter au `director`, pas à prendre seul.
