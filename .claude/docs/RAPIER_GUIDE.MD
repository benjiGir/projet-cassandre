---
name: threejs-rapier-fieldguide
description: Référence technique vérifiée sur Three.js + Rapier pour FPS navigateur — API exacte du character controller, encodage des groupes de collision, ghost collisions trimesh, déterminisme, pointer lock raw input, budget de draw calls, rendu rétro, audio Howler. Charger en complément des skills spécialisés dès qu'une décision technique porte sur Rapier, le raycast, l'input souris ou la performance de rendu.
---

# Guide de terrain — Three.js + Rapier pour FPS

Document de référence issu de la documentation officielle Rapier, Three.js, MDN
et de projets FPS existants. **Prime sur les valeurs mémorisées** : plusieurs
points ci-dessous corrigent des approximations courantes.

Versions de référence : Three.js r184 (avril 2026) · Rapier JS 0.17

---

## 0. Corrections au pack existant

Ces points invalident ou précisent ce qui était écrit dans les skills
`rapier-character-controller`, `audio-sfx-pipeline` et `fixed-timestep-loop`.

| Sujet | Ce qui était dit | Correction |
|---|---|---|
| Groupes de collision | table de bits par groupe | l'encodage réel est `membership << 16 \| filter` sur 32 bits — voir §2 |
| Colliders trimesh | `ColliderDesc.trimesh(v, i)` | il **faut** le 3ᵉ argument `FIX_INTERNAL_EDGES`, sinon ghost collisions — voir §3 |
| Triggers sensor | sensor + groupe `TRIGGER` | insuffisant : joueur kinématique vs body fixe exige `ActiveCollisionTypes.KINEMATIC_FIXED` — voir §4 |
| Test de déterminisme | boucle de simulation maison | `world.createSnapshot()` + hash donne un test bien plus fiable — voir §5 |
| Pool audio | classe `SfxPool` maison | Howler expose `pool: N` et les audio sprites nativement — voir §10 |
| Pointer lock | désactiver l'accélération OS | `unadjustedMovement` n'existe que sur Chromium, fallback obligatoire — voir §7 |
| Budget draw calls | < 150 | la cible communautaire est **< 100** — voir §9 |

---

## 1. Character controller — API exacte

Le `KinematicCharacterController` de Rapier émet lui-même les ray-casts et
shape-casts nécessaires pour ajuster la trajectoire. Trois limites structurelles
à connaître :

- **Il ne gère aucune rotation.** Uniquement des translations. La rotation vue
  est purement caméra, ce qui tombe bien pour un FPS.
- **Il n'applique pas la gravité.** C'est à toi d'ajouter une composante
  descendante au vecteur de mouvement désiré à chaque pas.
- **Il ne stocke aucune référence** vers le collider qu'il déplace. Une seule
  instance peut piloter plusieurs personnages.

```ts
const controller = world.createCharacterController(0.01);  // offset

controller.setUp({ x: 0, y: 1, z: 0 });
controller.setMaxSlopeClimbAngle(50 * Math.PI / 180);
controller.setMinSlopeSlideAngle(55 * Math.PI / 180);
controller.enableAutostep(0.35, 0.2, true);   // hauteur max, largeur mini, dynamiques
controller.enableSnapToGround(0.4);
controller.setApplyImpulsesToDynamicBodies(true);

// Par pas fixe :
controller.computeColliderMovement(collider, desiredTranslation);
const corrected = controller.computedMovement();
```

**L'offset** est la marge que le controller maintient entre le personnage et le
décor. Ne pas le changer après création. Si le personnage se coince
inexplicablement, l'augmenter est le premier réflexe.

**Application du résultat**, selon la représentation choisie :

| Représentation | Méthode |
|---|---|
| Collider seul (sans body) | `collider.setTranslation(pos + corrected)` |
| Body kinématique velocity-based | `rigidBody.setLinvel(corrected / dt)` |
| Body kinématique position-based | `rigidBody.setNextKinematicTranslation(pos + corrected)` |

**Autostep** ne s'active que si le personnage touche le sol juste avant
l'obstacle. C'est volontaire : ça évite d'être téléporté sur une plateforme en
plein saut.

**Formes recommandées** : cuboid, ball ou capsule. Les autres impliquent plus de
calculs et d'approximations numériques.

**Événements de collision** — disponibles après `computeColliderMovement`, dans
l'ordre chronologique du déplacement :

```ts
for (let i = 0; i < controller.numComputedCollisions(); i++) {
  const c = controller.computedCollision(i);
  // sons de pas selon le matériau, dégâts de chute, etc.
}
```

---

## 2. Groupes de collision — l'encodage réel

C'est le point le plus souvent mal implémenté. Un groupe de collision est **une
seule valeur 32 bits** :

```
[ 16 bits de membership ][ 16 bits de filtre ]
```

Le test appliqué par la narrow-phase entre deux colliders A et B :

```
((A.collisionGroups() >> 16) & (B.collisionGroups() & 0xffff)) != 0
&& ((B.collisionGroups() >> 16) & (A.collisionGroups() & 0xffff)) != 0
```

Les deux sens doivent passer. Un collider « invisible pour tous » n'est pas
obtenu en vidant son propre filtre, mais en s'assurant qu'aucun des deux tests
ne réussit.

Helper à écrire une fois :

```ts
const GROUP = {
  WORLD:       1 << 0,
  PLAYER:      1 << 1,
  ENEMY:       1 << 2,
  PLAYER_SHOT: 1 << 3,
  ENEMY_SHOT:  1 << 4,
  DEBRIS:      1 << 5,
  TRIGGER:     1 << 6,
} as const;

const groups = (membership: number, filter: number) =>
  ((membership & 0xffff) << 16) | (filter & 0xffff);

// Débris : membre de DEBRIS, ne collisionne qu'avec WORLD
colliderDesc.setCollisionGroups(groups(GROUP.DEBRIS, GROUP.WORLD));
```

**`collisionGroups` vs `solverGroups`** : le premier empêche le calcul même des
contacts (plus économique), le second laisse calculer les contacts mais pas les
forces. Utiliser `collisionGroups` par défaut ; `solverGroups` seulement si on
veut lire les contacts pour appliquer ses propres forces.

---

## 3. Trimesh et ghost collisions — le piège du niveau

Le sol d'un niveau importé depuis Blender est un maillage de triangles. Sans
précaution, le joueur **accroche sur les arêtes internes** entre triangles
coplanaires : le fameux « je me bloque sur un sol parfaitement plat ».

La correction existe et s'appelle `FIX_INTERNAL_EDGES` :

```ts
world.createCollider(
  RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
    .setCollisionGroups(groups(GROUP.WORLD, 0xffff)),
);
```

**À appliquer systématiquement sur toute géométrie de niveau.** Ne pas le faire
produit un bug de feel qui sera diagnostiqué comme un problème de character
controller, ce qui envoie sur une fausse piste coûteuse.

Autres règles trimesh :

- **Éviter les triangles longs et fins** — instabilité numérique de la
  détection de collision. À dire au level design : privilégier des faces
  régulières, quitte à subdiviser.
- **Un trimesh n'a pas d'intérieur.** Les tests de point-containment ne
  fonctionnent pas intuitivement. Ne jamais utiliser un trimesh pour un objet
  dynamique — utiliser une décomposition convexe ou une forme composée.
- **Les trimesh ne calculent pas leurs mass properties automatiquement.** Un
  body qui n'aurait que des colliders trimesh a une masse nulle et ne bouge pas.
- **Utiliser les SI** — mètres, secondes, kilogrammes. Utiliser des unités
  d'écran donne une simulation qui semble tourner au ralenti.

---

## 4. Triggers — le piège kinematic vs fixed

Par défaut, **la détection de collision est totalement désactivée entre deux
colliders attachés à des bodies non-dynamiques.**

Le joueur est kinématique. Les triggers du niveau sont sur des bodies fixes.
Conséquence : **les triggers ne se déclenchent jamais**, sans erreur ni warning.

```ts
triggerDesc
  .setSensor(true)
  .setActiveCollisionTypes(
    RAPIER.ActiveCollisionTypes.DEFAULT | RAPIER.ActiveCollisionTypes.KINEMATIC_FIXED,
  )
  .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
```

`setActiveEvents` est également obligatoire : **aucun événement de collision
n'est généré par défaut.**

Lecture des événements :

```ts
const eventQueue = new RAPIER.EventQueue(true);
world.step(eventQueue);
eventQueue.drainCollisionEvents((h1, h2, started) => { /* ... */ });
```

---

## 5. Déterminisme — un outil offert

La version WASM/JS de Rapier est **déterministe cross-platform**. Deux machines
différentes, OS différents, navigateurs différents, même version de Rapier :
résultats bit-à-bit identiques.

Conséquence directe pour `qa-evidence` — un test de non-régression physique
quasi gratuit :

```ts
// après N pas fixes, à conditions initiales identiques
const snapshot = world.createSnapshot();
const hash = md5(snapshot);   // identique sur toutes les machines
```

Ce hash remplace avantageusement un test de déterminisme écrit à la main.

**Conditions à respecter** : mêmes paramètres de simulation, bodies/colliders
construits de la même façon, **ajoutés et retirés dans le même ordre**.

**Piège majeur** : les fonctions transcendantes de JS — `Math.sin`, `Math.cos` —
ne sont **pas** déterministes cross-platform. Si elles servent à initialiser des
positions ou des vitesses, le déterminisme de Rapier ne sauve rien. Pour tout ce
qui alimente la physique, utiliser des tables précalculées ou des
approximations polynomiales déterministes.

---

## 6. Raycast hitscan — Rapier ou BVH ?

Deux options, et le choix dépend de la cible.

**`world.castRay()` de Rapier** — cohérent avec la physique, une seule source de
vérité, filtrage par groupes de collision inclus. C'est le choix par défaut pour
les tirs.

**`three-mesh-bvh`** — accélère le raycast Three.js de plusieurs ordres de
grandeur sur de la géométrie complexe (500 rayons contre 80 000 polygones à
60 fps). Utile pour tout raycast qui vise le **rendu** plutôt que la physique :
placement de decals sur la géométrie visible, LOS pour l'IA sur des meshes non
collidables, outils d'édition.

```ts
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
geometry.computeBoundsTree();
```

Notes :
- Centrer la géométrie (`BufferGeometry.center()`) avant de construire le BVH si
  elle est grande ou décentrée — précision flottante.
- Le BVH n'est **pas dynamique** : géométrie modifiée = `refit()` ou
  reconstruction.
- Un arbre séparé est généré **par groupe de géométrie** — beaucoup de groupes
  dégradent les performances de raycast.
- Renseigner `raycaster.near` / `far` : depuis la 0.7.5, la traversée ignore les
  bounds hors de cette plage.

**Ne pas maintenir les deux systèmes en parallèle pour le même usage.** Un tir
qui traverse un mur parce que la géométrie de rendu et la géométrie de collision
divergent est un bug pénible à diagnostiquer.

---

## 7. Pointer lock — raw input

L'accélération souris de l'OS est activée par défaut et rend la visée
« molle ». Elle se désactive via `unadjustedMovement` :

```ts
canvas.addEventListener('click', async () => {
  try {
    await canvas.requestPointerLock({ unadjustedMovement: true });
  } catch (e) {
    if ((e as DOMException).name === 'NotSupportedError') {
      await canvas.requestPointerLock();   // fallback obligatoire
    }
  }
});
```

**Support** : Chromium uniquement (Chrome, Edge). Firefox et Safari retombent
sur le delta ajusté par l'OS. Le fallback n'est pas optionnel.

Autres points :

- `movementX` / `movementY` portent le delta depuis l'événement précédent.
  `clientX/Y` et `screenX/Y` sont gelés pendant le lock.
- Le lock exige une **activation utilisateur** (clic). Même contrainte que la
  reprise du contexte audio — les brancher sur le même événement.
- `pointerlockchange` est le bon endroit pour mettre le jeu en pause.
- Dans une iframe, le token sandbox `allow-pointer-lock` est requis.
- **Sensibilité et résolution** : si tu changes la résolution interne du rendu,
  la sensibilité perçue change. Multiplier la sensibilité par le facteur
  d'échelle pour rester constant.

---

## 8. Déplacement — la référence Quake

Duke 3D et Ion Fury ne partagent pas le code de Quake, mais la sensation
« boomer shooter » moderne dérive du modèle Quake, qui est le mieux documenté.

**Accélération au sol** — `SV_Accelerate` applique `10 * frametime * wishspeed`,
soit la vitesse cible atteinte en **environ 0.1 s**. Contre-intuitif : cela
paraît instantané en jouant, mais 100 ms représentent 6 frames. La confirmation
que le tuning perceptuel ne doit jamais se faire à l'œil nu sans mesure.

**Air strafing** — le mécanisme n'est pas un cas particulier codé exprès, c'est
un effet de bord. La vitesse n'est pas clampée directement : **seule la
projection de la vélocité courante sur la direction d'accélération est
limitée**. Une direction d'input perpendiculaire à la vélocité a une projection
quasi nulle, donc l'accélération s'applique presque entièrement.

```ts
const projection = velocity.dot(wishDir);
let addSpeed = wishSpeed - projection;
if (addSpeed <= 0) return;
let accelSpeed = accel * dt * wishSpeed;
if (accelSpeed > addSpeed) accelSpeed = addSpeed;
velocity.addScaledVector(wishDir, accelSpeed);
```

**Décision de design à prendre explicitement** : garder ce comportement donne le
bunny hop et le strafe jump. C'est jouissif pour les joueurs qui connaissent,
opaque pour les autres. À trancher avant la Phase 1, pas après — ça change les
valeurs de tuning et le level design.

**Friction** — multiplicative, exprimable en demi-vie (temps pour réduire la
vitesse de moitié). Plus lisible à tuner qu'un coefficient brut.

**Bob** — dans Quake, la caméra bobbe légèrement en sinusoïde verticale, l'arme
bobbe davantage et différemment : elle reste relativement stable puis plonge
quand la caméra plonge. Ce n'est pas la même courbe sur les deux, et c'est ce
décalage qui donne la sensation de poids.

---

## 9. Performance Three.js

**Budget draw calls : viser sous 100.** C'est la métrique la plus déterminante
et la première à mesurer.

| Outil | Usage |
|---|---|
| `renderer.info` | draw calls, triangles, textures, geometries, programmes |
| `stats-gl` | overlay temps réel |
| Spector.js | capture et inspection d'une frame WebGL |

### Réduire les draw calls

- **Matériaux partagés.** Créer un nouveau matériau par objet annule le
  batching automatique de Three.js. C'est la correction la plus rentable et la
  plus fréquemment nécessaire.
- **`InstancedMesh`** — même géométrie, N instances, un draw call. C'est le bon
  choix pour les sprites d'ennemis, les douilles, les particules.
- **`BatchedMesh`** (r156+) — géométries **différentes**, même matériau, un draw
  call. Chaque instance garde sa matrice, sa visibilité et sa couleur.
  Pertinent pour le mobilier du niveau (gondoles, caddies, palettes) si tout
  partage l'atlas de textures.
- **`mergeGeometries`** pour la géométrie statique qui ne bougera jamais.
- **Array textures** (`DataArrayTexture`) — alternative à l'atlas : pas de
  bleeding entre cases, wrapping natif, mipmaps propres par couche. Contrainte :
  toutes les couches doivent avoir les mêmes dimensions. Combinée à
  `BatchedMesh`, permet de rendre des objets à textures différentes en un seul
  draw call, par indexation matérielle plutôt que par calcul d'UV.

Pour ce projet, l'array texture est probablement supérieure à l'atlas pour les
sprites 8 directions : les cases font toutes la même taille, et le bleeding
disparaît sans padding.

### Discipline de libération

Géométries, matériaux, textures et render targets occupent de la **mémoire GPU
qui n'est jamais libérée automatiquement**. `scene.remove()` et `scene.clear()`
ne libèrent rien. Il faut `.dispose()` explicitement sur chaque ressource.

C'est critique pour le hot reload de niveau : recharger un `.glb` sans disposer
l'ancien fait croître la mémoire à chaque itération jusqu'au crash de l'onglet.
Surveiller `renderer.info.memory.geometries` et `.textures` : ces compteurs ne
doivent pas croître d'un rechargement à l'autre.

### Sur le WebGPU

Disponible depuis r171 via `three/webgpu`, avec fallback WebGL2 automatique, et
supporté par tous les navigateurs majeurs depuis Safari 26. Les gains
(2-10×) concernent les scènes chargées en draw calls et le compute.

**Hors scope pour ce projet.** Un rendu 640×360 en Lambert avec moins de 100
draw calls ne touche aucune des limites que WebGPU lève. C'est une complexité
sans contrepartie ici.

---

## 10. Rendu rétro — Build ou PS1, pas les deux

Distinction que la plupart des tutoriels « retro Three.js » confondent, et qui
compte pour la direction artistique.

| Technique | PS1 | Build (Duke 3D, Ion Fury) |
|---|---|---|
| Basse résolution + nearest | oui | oui |
| Palette réduite + dithering | oui | oui |
| Sprites billboard pour les acteurs | parfois | **signature** |
| **Vertex jitter / snapping** | **oui** | **non** |
| **Affine texture mapping** (textures qui ondulent) | **oui** | **non** |
| Gouraud shading par sommet | oui | proche |
| Brouillard de distance | oui | oui |

**Le vertex jitter et l'affine mapping sont des artefacts PS1**, conséquences de
l'arithmétique en virgule fixe et de l'absence de correction perspective. Le
moteur Build calculait ses textures de façon perspective-correcte : Duke 3D
n'ondule pas et ne tremble pas.

Les ajouter à ce projet donnerait un jeu qui ressemble à Cultic ou Dusk, pas à
Ion Fury. Décision légitime, mais elle doit être prise consciemment — pas
héritée d'un tutoriel.

Pour le look Build, l'essentiel se limite à : basse résolution nearest, palette
réduite avec dithering ordonné, sprites 8 directions, textures 128×128,
éclairage par secteur plutôt que dynamique, et brouillard de distance.

Implémentations existantes à consulter : `playshader-one` (GLSL PS1 complet pour
Three.js), et la technique de patch global de `THREE.ShaderChunk` pour appliquer
dithering et posterisation sans toucher chaque matériau.

---

## 11. Audio — ce que Howler fait déjà

Deux fonctionnalités natives rendent inutile le code maison :

**`pool`** — Howler gère lui-même un pool d'instances par `Howl` :

```ts
const shotgun = new Howl({ src: ['sfx.ogg'], sprite: {...}, pool: 8 });
```

**Audio sprites** — un seul fichier contenant tous les SFX, découpé par offsets
nommés. Un seul décodage, une seule requête réseau, latence minimale. C'est le
pattern recommandé pour les effets courts d'un jeu.

```ts
const sfx = new Howl({
  src: ['sfx.ogg', 'sfx.m4a'],
  sprite: {
    shot:    [0, 420],
    reload:  [500, 780],
    impact:  [1400, 260],
  },
  pool: 12,
});
sfx.play('shot');
```

Reste à écrire à la main : la **variation de pitch** (`rate()` ±8 % sur les sons
répétés) et le ducking.

Repères de tuning : 50 sons superposés passent sans problème, 500 glitchent.
`html5: true` pour la musique (streaming, économise la mémoire) mais **jamais
pour les SFX** — ça casse la latence.

Contrainte navigateur : le contexte est suspendu jusqu'à une interaction
utilisateur. Le brancher sur le même clic que le pointer lock.

---

## 12. Projets de référence

| Projet | Intérêt |
|---|---|
| **Gorescript** (MIT, three.js) | Doom-like complet écrit en Three.js, avec **son propre éditeur de maps et éditeur de voxels**. La référence la plus proche du projet. À étudier pour la structure de données de niveau et le pipeline d'assets. |
| `threejs.org/examples` → `physics_rapier_character_controller` | Exemple officiel, minimal, à jour. Le point de départ le plus fiable. |
| **icurtis1/fps-sample-project** | FPS R3F + Rapier : mouvement, tir, rechargement, gamepad. Utile pour lire des choix de valeurs, même si l'approche R3F est écartée ici. |
| **mohsenheydari/three-fps** | FPS Three.js avec ECS léger, collision statique, triggers, IA ennemie. |
| `playshader-one` | Shader PS1 pour Three.js — à lire même en écartant l'esthétique PS1. |

Gorescript est le seul des cinq à avoir résolu le problème du **pipeline de
niveau**, qui est le point dur identifié en Phase 4. Ça vaut une lecture avant
d'écrire le loader glTF.

---

## Sources

- https://rapier.rs/docs/user_guides/javascript/character_controller
- https://rapier.rs/docs/user_guides/javascript/colliders
- https://rapier.rs/docs/user_guides/javascript/determinism
- https://rapier.rs/docs/user_guides/javascript/common_mistakes
- https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection_js
- https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock
- https://web.dev/articles/disable-mouse-acceleration
- https://github.com/gkjohnson/three-mesh-bvh
- https://threejs.org/manual/en/how-to-dispose-of-objects.html
- https://threejs.org/docs/pages/BatchedMesh.html
- https://adrianb.io/2015/02/14/bunnyhop.html
- https://blog.neon.moe/2020/04/03/fps-movement
- https://github.com/gorescript/gorescript
- https://github.com/BucketOSoftware/playshader-one
- https://howlerjs.com