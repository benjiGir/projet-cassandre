import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { COLLISION_GROUPS, type PhysicsWorld } from "../../physics/world";

/**
 * Pipeline de niveau glTF (Phase 4) — voir le skill `gltf-level-conventions`
 * pour le contrat complet. Ce fichier est le SEUL endroit qui connaît la
 * correspondance entre un préfixe de nom Blender et son effet en jeu.
 *
 * ## Le contrat de nommage (résumé, voir CLAUDE.md pour la table complète)
 *
 * | Préfixe          | Effet                                              |
 * |-------------------|-----------------------------------------------------|
 * | `col_*`           | collider trimesh statique, mesh invisible           |
 * | `spawn_player`    | position + orientation de départ (Empty)            |
 * | `spawn_suit_*`    | point d'apparition ennemi (Empty)                   |
 * | `trig_*`          | volume de trigger box, sensor Rapier, mesh invisible|
 * | `door_*`          | porte animée, collider dynamique                    |
 * | `use_*`           | objet interactif, portée 2 m                        |
 * | `secret_*`        | zone comptée dans le compteur de secrets            |
 *
 * Un mesh SANS préfixe reconnu est rendu tel quel, SANS collider,
 * SILENCIEUSEMENT — c'est le comportement par défaut voulu (le décor non
 * collidable est la majorité des objets d'un niveau ; un warning par mesh
 * rendrait la console inutilisable). Ne JAMAIS ajouter de `console.*` dans la
 * branche par défaut ci-dessous.
 *
 * En revanche, les avertissements suivants sont BRUYANTS (`console.error`,
 * jamais un `console.warn` discret — décision explicite du skill) :
 *   - `col_*` sans géométrie valide ou 0 triangle ;
 *   - `col_*` dépassant `MAX_COLLIDER_TRIANGLES` triangles (mesh oublié en
 *     high-poly — le collider est quand même créé, c'est un diagnostic, pas
 *     un blocage) ;
 *   - `spawn_player` absent ou en double ;
 *   - `trig_*` dont la géométrie n'est pas une box ;
 *   - `use_*` sans cible référencée dans ses `extras` (`userData.target`).
 *
 * ## Le piège des transforms (documenté par le skill, à ne pas re-découvrir)
 *
 * Un mesh `col_*`/`trig_*` peut être imbriqué n'importe où dans la hiérarchie
 * Blender (collections, empties parents...). Extraire `geometry.attributes
 * .position` SANS appliquer `mesh.matrixWorld` donne des colliders qui
 * matchent la géométrie LOCALE, décalée d'un offset constant par rapport au
 * mesh rendu dès que le mesh a un parent non identité. La séquence correcte,
 * appliquée uniformément ici via `worldSpaceGeometry` :
 *   1. `root.updateWorldMatrix(true, true)` UNE FOIS avant toute lecture de
 *      `matrixWorld` (fait au tout début de `buildLevelFromGltf`, couvre tout
 *      le sous-arbre en un seul passage — équivalent au `obj.updateWorldMatrix
 *      (true, false)` par-objet du skill, juste amorti sur toute la scène) ;
 *   2. cloner la géométrie et lui appliquer `matrixWorld` AVANT de la passer
 *      à Rapier.
 *
 * ## Invariant #5 — MeshLambertMaterial exclusif (NON NÉGOCIABLE)
 *
 * `GLTFLoader` matérialise CHAQUE primitive glTF en `MeshStandardMaterial`
 * (le modèle PBR metallic-roughness est natif au format). Importer un niveau
 * tel quel viole donc silencieusement l'invariant #5 du projet — le look
 * "Build engine" du jeu vient précisément de l'ABSENCE de spécularité. Ce
 * fichier reconvertit donc CHAQUE mesh importé (pas seulement les `col_*`,
 * qui de toute façon ne sont jamais rendus visibles) en `MeshLambertMaterial`
 * via `convertToLambert`, en ne gardant que couleur de base + texture diffuse
 * (`map`) et en jetant roughness/metalness/normalMap/etc. L'invariant #4
 * (`NearestFilter`, pas de mipmaps) est appliqué à toute texture survivante.
 *
 * SI CE FICHIER EST RETOUCHÉ PLUS TARD : ne retire jamais cet appel. L'erreur
 * qui en résulterait est silencieuse (le niveau importé "a l'air" normal en
 * dev, juste avec des reflets spéculaires qui ne devraient jamais exister à
 * l'écran dans ce projet).
 */

// ---------------------------------------------------------------------------
// Types publics
// ---------------------------------------------------------------------------

export interface SpawnPoint {
  /** Position MONDE. Convention : l'origine de l'Empty Blender représente les
   * PIEDS du joueur (le sol), pas les yeux — même convention que `gym.spawn`
   * consommée par `player.spawn(x, feetY, z)` dans `main.ts`. Si le pipeline
   * Blender de l'utilisateur place ses Empties `spawn_player` au niveau des
   * yeux plutôt qu'au sol, cette convention doit être ajustée ICI (un seul
   * endroit) plutôt que dans chaque appelant. */
  position: THREE.Vector3;
  /** Yaw, radians. Convention `main.ts`/`gym.ts` (Euler 'YXZ') : yaw=0 -> avant = -Z. */
  yaw: number;
}

export interface NamedSpawn {
  name: string;
  /** Position MONDE, pieds (même convention que `SpawnPoint.position`). */
  position: THREE.Vector3;
}

export interface TriggerVolume {
  name: string;
  object: THREE.Object3D;
  /** Coin min/max de la box en espace MONDE (rotation ignorée pour ce résumé
   * — suffisant pour un compteur de debug ou un futur `interactive.ts` qui
   * testerait une position simple ; la vraie forme physique, elle, est un
   * cuboid ORIENTÉ posé sur le corps Rapier créé en parallèle). */
  min: THREE.Vector3;
  max: THREE.Vector3;
  extras: Record<string, unknown>;
}

export interface DoorInfo {
  name: string;
  object: THREE.Object3D;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  /** Clip d'animation glTF associé à ce nœud, s'il existe. PARSÉ, PAS JOUÉ —
   * lire un mixer et déclencher l'ouverture est le scope de
   * `game/level/interactive.ts` (hors Phase 4). */
  clip: THREE.AnimationClip | null;
  extras: Record<string, unknown>;
}

export interface UseObject {
  name: string;
  object: THREE.Object3D;
  /** Position MONDE. */
  position: THREE.Vector3;
  /** Portée d'usage, mètres. Constante du contrat (voir CLAUDE.md), pas une
   * valeur par objet. */
  range: number;
  /** Nom de l'objet ciblé, lu dans `extras.target` (custom property Blender
   * `target`, string). `null` si absent — un `use_*` sans cible est un
   * avertissement bruyant (voir plus haut), pas une erreur bloquante : le
   * niveau continue de charger. */
  targetName: string | null;
  extras: Record<string, unknown>;
}

export interface SecretZone {
  name: string;
  object: THREE.Object3D;
  min: THREE.Vector3;
  max: THREE.Vector3;
  extras: Record<string, unknown>;
}

export interface LevelStats {
  colliderCount: number;
  spawnSuitCount: number;
  triggerCount: number;
  doorCount: number;
  useCount: number;
  secretCount: number;
  /** Meshes rendus tels quels, sans préfixe reconnu — le cas SILENCIEUX. */
  unprefixedMeshCount: number;
}

export interface LevelHandle {
  /** Racine ajoutée à `scene` (= `gltf.scene`). */
  root: THREE.Object3D;
  gltf: GLTF;
  /** `null` si absent du fichier — voir l'avertissement bruyant correspondant. */
  spawnPlayer: SpawnPoint | null;
  spawnSuits: NamedSpawn[];
  triggers: TriggerVolume[];
  doors: DoorInfo[];
  useObjects: UseObject[];
  secrets: SecretZone[];
  stats: LevelStats;
  /**
   * Retire `root` de la scène et libère TOUS les corps/colliders Rapier créés
   * pour ce niveau (un `world.removeRigidBody` par corps suffit : Rapier
   * retire automatiquement les colliders attachés, voir sa doc). Géométries
   * et matériaux clonés sont aussi disposés côté GPU. Sûr à appeler plusieurs
   * fois (no-op après le premier appel réel — voir l'implémentation).
   *
   * C'est la brique de base du hot reload (`hotReload.ts`) : dispose puis
   * `buildLevelFromGltf` à nouveau, sans jamais toucher au joueur.
   */
  dispose(): void;
}

/** Portée d'usage d'un `use_*`, mètres — contrat CLAUDE.md, pas un réglage par objet. */
const USE_RANGE_METERS = 2;

/** Signe d'un mesh `col_*` oublié en high-poly (skill `gltf-level-conventions`). */
const MAX_COLLIDER_TRIANGLES = 50_000;

// ---------------------------------------------------------------------------
// Conversion de matériau — invariant #5 (voir doc de tête du fichier)
// ---------------------------------------------------------------------------

function toLambert(mat: THREE.Material): THREE.MeshLambertMaterial {
  const src = mat as THREE.MeshStandardMaterial;
  const lambert = new THREE.MeshLambertMaterial({
    color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
    map: src.map ?? null,
    transparent: src.transparent,
    opacity: src.opacity,
    side: src.side,
    alphaTest: src.alphaTest,
    // volontairement absents : roughnessMap/metalnessMap/normalMap/envMap —
    // c'est exactement ce que l'invariant #5 demande de jeter.
  });
  lambert.name = mat.name;
  if (lambert.map) {
    // Invariant #4 : NearestFilter partout, jamais de mipmaps. Une texture
    // survivante d'un glTF (filtrage linéaire par défaut) casserait
    // silencieusement l'identité visuelle rétro sinon.
    lambert.map.magFilter = THREE.NearestFilter;
    lambert.map.minFilter = THREE.NearestFilter;
    lambert.map.generateMipmaps = false;
    lambert.map.needsUpdate = true;
  }
  return lambert;
}

function convertToLambert(mesh: THREE.Mesh): void {
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map(toLambert);
  } else {
    mesh.material = toLambert(mesh.material);
  }
}

// ---------------------------------------------------------------------------
// Nom "tel que tapé dans Blender" — piège découvert en construisant la
// fixture de validation de ce fichier, pas documenté par le skill.
// ---------------------------------------------------------------------------

/**
 * `GLTFLoader` RÉÉCRIT `.name` de CHAQUE nœud importé via sa méthode interne
 * `createUniqueName()` : « When Object3D instances are targeted by animation,
 * they need unique names. » Deux Empties nommés IDENTIQUEMENT `spawn_player`
 * dans Blender ressortent donc de l'import comme `spawn_player` et
 * `spawn_player_1` — un contrôle de préfixe/égalité sur `obj.name` ne verrait
 * JAMAIS ce doublon, silencieusement, exactement le genre de bug que ce
 * fichier est censé signaler bruyamment.
 *
 * `GLTFLoader` préserve heureusement le nom BRUT du glTF dans
 * `node.userData.name` (assigné avant la ré-écriture, voir GLTFLoader.js).
 * C'est CETTE valeur qu'il faut lire pour tout ce qui touche au contrat de
 * nommage ci-dessous — jamais `obj.name` directement.
 *
 * Exception : `findClipForObject` continue de lire `mesh.name` (mangled) à
 * dessein, parce que `GLTFLoader` construit les noms de piste d'animation à
 * partir de ce même `.name` ré-écrit — les deux restent cohérents ENTRE EUX
 * même après mangling, donc comparer l'un à l'autre reste correct.
 */
function blenderName(obj: THREE.Object3D): string {
  const raw = (obj.userData as Record<string, unknown> | undefined)?.name;
  return typeof raw === "string" ? raw : obj.name;
}

/**
 * Copie de `userData` pour `extras`, SANS la clé `name` que `GLTFLoader` y
 * injecte lui-même pour tout nœud nommé (voir `blenderName` ci-dessus) — ce
 * n'est pas une custom property Blender, l'exposer dans `extras` polluerait
 * la seule donnée qu'un futur `interactive.ts` doit pouvoir lire telle
 * quelle (ex. `extras.target`, `extras.hp`...).
 */
function cleanExtras(obj: THREE.Object3D): Record<string, unknown> {
  const { name: _internalName, ...rest } = obj.userData as Record<string, unknown>;
  return rest;
}

// ---------------------------------------------------------------------------
// Géométrie monde (le piège documenté en tête de fichier)
// ---------------------------------------------------------------------------

function worldSpaceGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  return geo;
}

function buildSequentialIndex(vertexCount: number): Uint32Array {
  const idx = new Uint32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) idx[i] = i;
  return idx;
}

/**
 * Un mesh est une "box" si TOUS ses sommets sont sur un coin de sa propre
 * bounding box locale — plus robuste qu'une simple comparaison de nom ou un
 * `instanceof THREE.BoxGeometry` (Blender exporte toujours des
 * `BufferGeometry` génériques, jamais les classes `THREE.*Geometry`).
 * Vérifié en espace LOCAL, pas monde : un cuboid tourné par le parent reste
 * une box valide (c'est la rotation du corps Rapier qui l'exprime, voir
 * `buildTrigger`), une déformation non uniforme (cisaillement) ou toute forme
 * non convexe-boîte échoue le test quel que soit son alignement.
 */
function isAxisAlignedBox(geometry: THREE.BufferGeometry, epsilon = 1e-4): boolean {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!position || position.count === 0) return false;
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  if (!bb) return false;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const onX = Math.abs(x - bb.min.x) < epsilon || Math.abs(x - bb.max.x) < epsilon;
    const onY = Math.abs(y - bb.min.y) < epsilon || Math.abs(y - bb.max.y) < epsilon;
    const onZ = Math.abs(z - bb.min.z) < epsilon || Math.abs(z - bb.max.z) < epsilon;
    if (!(onX && onY && onZ)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Extraction par préfixe
// ---------------------------------------------------------------------------

/** `col_*` : collider trimesh statique, mesh rendu invisible. Retourne `true`
 * si un collider a bien été créé (faux pour une géométrie invalide/0 triangle,
 * voir l'avertissement bruyant émis dans ce cas). */
function buildStaticCollider(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): boolean {
  const worldGeometry = worldSpaceGeometry(mesh);
  const positionAttr = worldGeometry.getAttribute("position") as THREE.BufferAttribute | undefined;

  if (!positionAttr || positionAttr.count === 0) {
    console.error(`[level] "${name}" (col_*) sans géométrie valide — aucun collider créé.`);
    worldGeometry.dispose();
    return false;
  }

  const indexAttr = worldGeometry.getIndex();
  const rawIndices = indexAttr ? indexAttr.array : buildSequentialIndex(positionAttr.count);
  const triangleCount = Math.floor(rawIndices.length / 3);

  if (triangleCount === 0) {
    console.error(`[level] "${name}" (col_*) a 0 triangle — aucun collider créé.`);
    worldGeometry.dispose();
    return false;
  }
  if (triangleCount > MAX_COLLIDER_TRIANGLES) {
    console.error(
      `[level] "${name}" (col_*) : ${triangleCount} triangles, au-delà du seuil de ` +
        `${MAX_COLLIDER_TRIANGLES} — signe probable d'un mesh oublié en high-poly. ` +
        `Collider créé quand même.`,
    );
  }

  const vertices =
    positionAttr.array instanceof Float32Array
      ? positionAttr.array
      : Float32Array.from(positionAttr.array as ArrayLike<number>);
  const indices = rawIndices instanceof Uint32Array ? rawIndices : Uint32Array.from(rawIndices as ArrayLike<number>);

  const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  physics.world.createCollider(
    RAPIER.ColliderDesc.trimesh(vertices, indices).setCollisionGroups(COLLISION_GROUPS.WORLD),
    body,
  );
  bodies.push(body);

  worldGeometry.dispose();
  return true;
}

/** `spawn_player` (Empty) : position + yaw. Voir la doc de `SpawnPoint` pour
 * la convention pieds/yeux. */
function extractSpawnPoint(obj: THREE.Object3D): SpawnPoint {
  const position = new THREE.Vector3();
  obj.getWorldPosition(position);

  const worldQuat = new THREE.Quaternion();
  obj.getWorldQuaternion(worldQuat);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat);
  // Convention `main.ts`/`gym.ts` (Euler 'YXZ', vérifiée par calcul dans
  // `gym.ts`) : yaw=0 -> avant = -Z, dérivation identique à wishX/wishZ dans
  // `PlayerController.update` (forward = (-sin(yaw), 0, -cos(yaw))).
  const yaw = Math.atan2(-forward.x, -forward.z);

  return { position, yaw };
}

/** `trig_*` : volume box, sensor Rapier. `null` si la géométrie n'est pas une
 * box (avertissement bruyant déjà émis par l'appelant dans ce cas). */
function buildTrigger(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): TriggerVolume | null {
  if (!isAxisAlignedBox(mesh.geometry)) {
    console.error(`[level] "${name}" (trig_*) n'est pas une géométrie box — trigger ignoré.`);
    return null;
  }

  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);
  const localCenter = new THREE.Vector3().addVectors(bb.min, bb.max).multiplyScalar(0.5);

  const worldPosition = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  mesh.matrixWorld.decompose(worldPosition, worldQuat, worldScale);

  const worldCenter = localCenter.clone().applyMatrix4(mesh.matrixWorld);
  const halfExtents = new THREE.Vector3(
    Math.abs((localSize.x * worldScale.x) / 2),
    Math.abs((localSize.y * worldScale.y) / 2),
    Math.abs((localSize.z * worldScale.z) / 2),
  );

  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(worldCenter.x, worldCenter.y, worldCenter.z)
      .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w }),
  );
  physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
      .setSensor(true)
      .setCollisionGroups(COLLISION_GROUPS.TRIGGER),
    body,
  );
  bodies.push(body);

  return {
    name,
    object: mesh,
    min: worldCenter.clone().sub(halfExtents),
    max: worldCenter.clone().add(halfExtents),
    extras: cleanExtras(mesh),
  };
}

/** Cherche le clip glTF dont une piste cible ce nœud (par nom — voir
 * `PATH_PROPERTIES`/`targetName` de `GLTFLoader.js` : le nom de piste est
 * toujours `<nom du nœud>.<propriété>`). Ne joue rien, se contente d'exposer
 * le clip pour un futur `interactive.ts`. */
function findClipForObject(clips: THREE.AnimationClip[], object: THREE.Object3D): THREE.AnimationClip | null {
  for (const clip of clips) {
    for (const track of clip.tracks) {
      const dot = track.name.indexOf(".");
      const nodeName = dot === -1 ? track.name : track.name.slice(0, dot);
      if (nodeName === object.name || nodeName === object.uuid) return clip;
    }
  }
  return null;
}

/** `door_*` : porte animée. Collider DYNAMIQUE (contrat CLAUDE.md — pas
 * `fixed()` comme `col_*`, pas non plus le `KinematicCharacterController` du
 * joueur, invariant #6 réservé au joueur). Verrouillé (translations +
 * rotations, gravité neutralisée) tant qu'aucune logique de jeu ne le pilote
 * : une porte non pilotée ne doit ni tomber sous la gravité −25 m/s² ni
 * dériver au moindre contact avant que `game/level/interactive.ts` (hors
 * scope Phase 4) ne la débloque explicitement pour l'animer. */
function buildDoor(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
  clips: THREE.AnimationClip[],
): DoorInfo {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);

  const worldPosition = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  mesh.matrixWorld.decompose(worldPosition, worldQuat, worldScale);

  const halfExtents = new THREE.Vector3(
    Math.max(1e-3, Math.abs((localSize.x * worldScale.x) / 2)),
    Math.max(1e-3, Math.abs((localSize.y * worldScale.y) / 2)),
    Math.max(1e-3, Math.abs((localSize.z * worldScale.z) / 2)),
  );

  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(worldPosition.x, worldPosition.y, worldPosition.z)
      .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w })
      .setGravityScale(0)
      .lockTranslations()
      .lockRotations(),
  );
  const collider = physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setCollisionGroups(
      COLLISION_GROUPS.WORLD,
    ),
    body,
  );
  bodies.push(body);

  return {
    name,
    object: mesh,
    body,
    collider,
    clip: findClipForObject(clips, mesh),
    extras: cleanExtras(mesh),
  };
}

/** `use_*` : objet interactif, portée 2 m. Cible lue dans `extras.target`
 * (custom property Blender `target`, string — nom d'un autre nœud du même
 * niveau, typiquement un `door_*`). Absence de cible = avertissement bruyant,
 * PAS un blocage : l'objet est quand même retourné avec `targetName: null`. */
function buildUseObject(mesh: THREE.Mesh, name: string): UseObject {
  const position = new THREE.Vector3();
  mesh.getWorldPosition(position);

  const extras = cleanExtras(mesh);
  const targetName = typeof extras.target === "string" ? extras.target : null;
  if (!targetName) {
    console.error(
      `[level] "${name}" (use_*) n'a pas de cible référencée dans ses extras ` +
        `(custom property Blender "target" attendue) — objet interactif sans effet exploitable.`,
    );
  }

  return { name, object: mesh, position, range: USE_RANGE_METERS, targetName, extras };
}

/** `secret_*` : zone comptée dans le compteur de secrets. Même traitement
 * géométrique qu'un `trig_*` côté extraction (bounding box monde), mais AUCUNE
 * exigence de forme box ici — un secret peut être une zone irrégulière, sa
 * détection appartiendra à `interactive.ts`, pas à ce loader. */
function buildSecretZone(mesh: THREE.Mesh, name: string): SecretZone {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  const corners = [
    new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z),
    new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z),
  ].map((v) => v.applyMatrix4(mesh.matrixWorld));

  const min = new THREE.Vector3(
    Math.min(corners[0].x, corners[1].x),
    Math.min(corners[0].y, corners[1].y),
    Math.min(corners[0].z, corners[1].z),
  );
  const max = new THREE.Vector3(
    Math.max(corners[0].x, corners[1].x),
    Math.max(corners[0].y, corners[1].y),
    Math.max(corners[0].z, corners[1].z),
  );

  return { name, object: mesh, min, max, extras: cleanExtras(mesh) };
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

/**
 * Construit un `LevelHandle` à partir d'un résultat `GLTFLoader` déjà parsé.
 * Fonction PURE côté entrée/sortie (aucun accès réseau/DOM ici) : c'est ce
 * qui la rend utilisable aussi bien depuis `loadLevel` (navigateur, via
 * `GLTFLoader.loadAsync`) que depuis un harnais Node headless qui appelle
 * `GLTFLoader.parse` directement sur des octets lus par `fs` — voir le script
 * de validation de la fixture.
 */
export function buildLevelFromGltf(gltf: GLTF, scene: THREE.Scene, physics: PhysicsWorld): LevelHandle {
  const root = gltf.scene;
  scene.add(root);
  // Un seul passage sur tout le sous-arbre AVANT toute lecture de
  // `matrixWorld` ci-dessous (voir « le piège des transforms » en tête de
  // fichier) : équivalent au `obj.updateWorldMatrix(true, false)` par-objet
  // du skill, amorti sur toute la hiérarchie en un seul appel.
  root.updateWorldMatrix(true, true);

  const bodies: RAPIER.RigidBody[] = [];

  let spawnPlayer: SpawnPoint | null = null;
  let spawnPlayerCount = 0;
  const spawnSuits: NamedSpawn[] = [];
  const triggers: TriggerVolume[] = [];
  const doors: DoorInfo[] = [];
  const useObjects: UseObject[] = [];
  const secrets: SecretZone[] = [];

  let colliderCount = 0;
  let unprefixedMeshCount = 0;

  root.traverse((obj) => {
    // Nom "tel que tapé dans Blender", PAS `obj.name` — voir la doc de
    // `blenderName` (piège `GLTFLoader.createUniqueName`).
    const name = blenderName(obj);

    // --- Empties : jamais un THREE.Mesh, traités avant le filtre `instanceof` ---
    if (name === "spawn_player") {
      spawnPlayerCount++;
      if (spawnPlayerCount === 1) spawnPlayer = extractSpawnPoint(obj);
      return;
    }
    if (name.startsWith("spawn_suit_")) {
      const position = new THREE.Vector3();
      obj.getWorldPosition(position);
      spawnSuits.push({ name, position });
      return;
    }

    if (!(obj instanceof THREE.Mesh)) return;

    // Invariant #5 (+ #4 pour les textures survivantes) : AVANT toute autre
    // chose, pour CHAQUE mesh, préfixé ou non — voir la doc de tête de fichier.
    convertToLambert(obj);

    if (name.startsWith("col_")) {
      if (buildStaticCollider(obj, name, physics, bodies)) colliderCount++;
      obj.visible = false;
      return;
    }

    if (name.startsWith("trig_")) {
      const trigger = buildTrigger(obj, name, physics, bodies);
      if (trigger) triggers.push(trigger);
      obj.visible = false;
      return;
    }

    if (name.startsWith("door_")) {
      doors.push(buildDoor(obj, name, physics, bodies, gltf.animations));
      return; // reste visible : c'est un panneau de décor animé, pas un volume logique
    }

    if (name.startsWith("use_")) {
      useObjects.push(buildUseObject(obj, name));
      return; // reste visible (objet interactif physique, ex. un terminal)
    }

    if (name.startsWith("secret_")) {
      secrets.push(buildSecretZone(obj, name));
      obj.visible = false; // volume logique, comme trig_*
      return;
    }

    // Mesh sans préfixe reconnu : rendu tel quel, SANS collider,
    // SILENCIEUSEMENT (voir la doc de tête de fichier — ne rien logger ici).
    unprefixedMeshCount++;
  });

  if (spawnPlayerCount === 0) {
    console.error("[level] spawn_player absent du niveau — le joueur ne peut pas être positionné au chargement.");
  } else if (spawnPlayerCount > 1) {
    console.error(
      `[level] spawn_player en double (${spawnPlayerCount} occurrences) — seule la première rencontrée est utilisée.`,
    );
  }

  const stats: LevelStats = {
    colliderCount,
    spawnSuitCount: spawnSuits.length,
    triggerCount: triggers.length,
    doorCount: doors.length,
    useCount: useObjects.length,
    secretCount: secrets.length,
    unprefixedMeshCount,
  };

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.remove(root);
    for (const body of bodies) physics.world.removeRigidBody(body); // retire aussi les colliders attachés (doc Rapier)
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        const lambert = mat as THREE.MeshLambertMaterial;
        lambert.map?.dispose();
        lambert.dispose();
      }
    });
  }

  return { root, gltf, spawnPlayer, spawnSuits, triggers, doors, useObjects, secrets, stats, dispose };
}

/**
 * Charge un `.glb`/`.gltf` par URL (navigateur, via `fetch` interne à
 * `GLTFLoader`/`FileLoader`) et construit son `LevelHandle`. C'est la seule
 * fonction de ce fichier qui touche le réseau — `buildLevelFromGltf`
 * au-dessus reste testable hors navigateur.
 */
export async function loadLevel(url: string, scene: THREE.Scene, physics: PhysicsWorld): Promise<LevelHandle> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  return buildLevelFromGltf(gltf, scene, physics);
}
