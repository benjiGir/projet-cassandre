---
name: billboard-sprites-8dir
description: Système de sprites billboard 8 directions pour les ennemis — maths de sélection d'angle, atlas UV, yaw-only billboard, alphaTest, InstancedMesh, tri de profondeur. Charger pour tout rendu d'entité ou de décor sprite.
---

# Sprites 8 directions

## Pourquoi pas `THREE.Sprite`

`THREE.Sprite` billboard sur les trois axes : les ennemis penchent quand le
joueur regarde en l'air ou vers le sol. Il faut un `PlaneGeometry` qui ne
tourne que sur le yaw.

## Le billboard

```ts
mesh.rotation.y = Math.atan2(
  camera.position.x - mesh.position.x,
  camera.position.z - mesh.position.z
);
```

## La sélection de direction

L'angle entre l'orientation de l'ennemi et le vecteur vers la caméra :

```ts
const toCam = new THREE.Vector3()
  .subVectors(camera.position, enemy.position)
  .setY(0).normalize();

const fwd = enemy.forward;   // normalisé, Y = 0

const angle = Math.atan2(
  fwd.x * toCam.z - fwd.z * toCam.x,   // composante Y du produit vectoriel
  fwd.x * toCam.x + fwd.z * toCam.z    // produit scalaire
);

const dir = Math.round(
  ((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)
) % 8;

material.map.offset.set(dir / 8, row / ROWS);
material.map.repeat.set(1 / 8, 1 / ROWS);
```

`dir = 0` correspond à l'ennemi vu **de face**. Documente cette convention
dans l'atlas, sinon les sprites sont décalés de 4 cases et le bug est
étonnamment difficile à voir.

## Atlas

8 colonnes (directions) × N lignes (frames). Une texture, un matériau.
Un padding d'1 px transparent autour de chaque case évite le bleeding, même en
`NearestFilter`, à cause de l'imprécision flottante sur les UV.

## Transparence

```ts
material.alphaTest = 0.5;
material.transparent = false;   // important
material.depthWrite = true;
```

`alphaTest` plutôt que `transparent` : ça écrit dans le depth buffer, donc pas
de tri de profondeur à gérer et pas d'artefact quand deux ennemis se
chevauchent. C'est exactement ce que faisaient les moteurs de l'époque.

## Performance

En dessous de 30 sprites simultanés, un `Mesh` par entité suffit. Au-delà,
`InstancedMesh` avec les offsets UV en attribut d'instance :

```ts
const uvOffsets = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
geometry.setAttribute('uvOffset', uvOffsets);
// puis dans le vertex shader : vUv = uv * uvScale + uvOffset;
```

## Contrat

| Aspect | Règle |
|---|---|
| Entrées déterministes | position, forward, état, frame courante |
| Paramètres exposés | `ROWS`, `alphaTest`, taille du quad, offset vertical |
| Diagnostic | mosaïque 8 directions × N états, générée à la demande |
| Stabilité en distance | le sprite ne doit pas changer de taille apparente non linéairement |

## Diagnostic visuel

Génère une **mosaïque** de contrôle : toutes les directions × tous les états,
caméra fixe. C'est la façon la plus rapide de repérer une case manquante, un
décalage d'index ou un bleeding d'atlas.
