import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Effect, Exit, Schema, Scope } from "effect";

import { LevelResources } from "./levelResources";
import type {
  SpawnPoint,
  NamedSpawn,
  TriggerVolume,
  UseObject,
  SecretZone,
  LevelStats,
  LevelHandle,
} from "./levelTypes";
import { COLLISION_GROUPS, type PhysicsWorld } from "../../physics/world";
import { GameRuntime } from "../../core/runtime";
import { configureRetroTexture } from "../../render/renderer";
import { mergeStaticDecor } from "./mergeStaticDecor";
import {
  DEFAULT_PROP_MATERIAL,
  PROP_MATERIALS,
  parsePropMaterial,
  type PropInfo,
  type PropMaterial,
} from "./props";
import {
  batchDoorMeshes,
  DEFAULT_DOOR_MOVEMENT,
  DOOR_MOVEMENTS,
  parseDoorMovement,
  type DoorInfo,
  type DoorMovement,
} from "./doors";
import { mergeVitreDecor, type VitreCandidate } from "./vitres";
import {
  mergeSanitaireDecor,
  DEFAULT_SANITAIRE_KIND,
  SANITAIRE_KINDS,
  parseSanitaireKind,
  type SanitaireCandidate,
  type SanitaireKind,
} from "./sanitaires";
import { LOYALTY_CARDS, parseLoyaltyCard, type LoyaltyCard } from "../player/loyaltyCards";
import { FOOD_HEAL_AMOUNTS, FOOD_ITEMS, parseFoodItem, type FoodItem } from "./food";
import {
  mergeEcranDecor,
  DEFAULT_ECRAN_CHAINE,
  ECRAN_CHAINES,
  parseEcranChaine,
  type EcranCandidate,
  type EcranChaine,
} from "./ecrans";
import type { CamPoint } from "./cameras";
import { initialiserDouches } from "./douches";
import { NAME_WIRED_USE_OBJECTS } from "./interactive";

// see: docs/6-reference/notes-code-gameplay-niveau.md#chargement-et-ressources

// see: docs/5-guides/modifier-le-niveau.md

/** Portée d'usage d'un `use_*`, mètres — voir reference/conventions-nommage.md. */
const USE_RANGE_METERS = 2;

/** Signe d'un mesh `col_*` oublié en high-poly — voir
 * reference/conventions-nommage.md. */
const MAX_COLLIDER_TRIANGLES = 50_000;

// Erreurs typées (jalon M2) — une par cas de dégradation. Patron uniforme
// "fail immédiatement rattrapé au point de détection" pour les 7 cas.
// see: docs/archive/pipeline-niveau-blender.md#cycle-de-vie-du-levelhandle

export class MissingColliderGeometryError extends Schema.TaggedError<MissingColliderGeometryError>()(
  "MissingColliderGeometryError",
  {
    name: Schema.String,
    prefixLabel: Schema.Literals(["col_*", "col_hull_*"]),
    reason: Schema.Literals(["missing-geometry", "zero-triangles"]),
  },
) {}

/** `col_*` dépassant `MAX_COLLIDER_TRIANGLES` — jamais bloquant, le collider
 * est créé quand même (diagnostic de mesh oublié en high-poly). */
export class OversizedColliderWarning extends Schema.TaggedError<OversizedColliderWarning>()(
  "OversizedColliderWarning",
  {
    name: Schema.String,
    triangleCount: Schema.Number,
  },
) {}

/** `spawn_player` absent du niveau. */
export class MissingSpawnPlayerError extends Schema.TaggedError<MissingSpawnPlayerError>()(
  "MissingSpawnPlayerError",
  {},
) {}

/** `spawn_player` présent plus d'une fois — seul le premier rencontré compte. */
export class DuplicateSpawnPlayerError extends Schema.TaggedError<DuplicateSpawnPlayerError>()(
  "DuplicateSpawnPlayerError",
  { count: Schema.Number },
) {}

/** `trig_*` dont la géométrie n'est pas une box axis-aligned (locale). */
export class NonBoxTriggerError extends Schema.TaggedError<NonBoxTriggerError>()("NonBoxTriggerError", {
  name: Schema.String,
}) {}

/** `use_*` sans `extras.target` — jamais bloquant, l'objet est quand même
 * retourné avec `targetName: null`. */
export class UntargetedUseObjectWarning extends Schema.TaggedError<UntargetedUseObjectWarning>()(
  "UntargetedUseObjectWarning",
  { name: Schema.String },
) {}

export class UnknownLoyaltyCardWarning extends Schema.TaggedError<UnknownLoyaltyCardWarning>()(
  "UnknownLoyaltyCardWarning",
  { name: Schema.String, property: Schema.String, value: Schema.String },
) {}

/** `use_*` dont `extras.soin` n'est pas un nombre strictement positif — une
 * trousse qui ne soignerait rien, ou une faute de frappe. Jamais bloquant :
 * l'objet est retourné avec `heals: null`. */
export class InvalidHealAmountWarning extends Schema.TaggedError<InvalidHealAmountWarning>()(
  "InvalidHealAmountWarning",
  { name: Schema.String, value: Schema.String, property: Schema.String },
) {}

export class UnknownFoodItemWarning extends Schema.TaggedError<UnknownFoodItemWarning>()(
  "UnknownFoodItemWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `prop_*` dont `extras.matiere` n'est pas une matière connue — jamais
 * bloquant : le prop est construit avec `DEFAULT_PROP_MATERIAL`. */
export class UnknownPropMaterialWarning extends Schema.TaggedError<UnknownPropMaterialWarning>()(
  "UnknownPropMaterialWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `prop_*` dont `extras.masse`/`extras.pv` n'est pas un nombre strictement
 * positif — jamais bloquant : la propriété est ignorée et le prop prend le
 * défaut du préfixe (masse de repli, ou indestructible pour `pv`). */
export class InvalidPropNumberWarning extends Schema.TaggedError<InvalidPropNumberWarning>()(
  "InvalidPropNumberWarning",
  { name: Schema.String, property: Schema.String, value: Schema.String },
) {}

/** `prop_*` dont `extras.contenu` n'est pas au format `"nom:nombre"` (nombre
 * entier strictement positif) — jamais bloquant : le prop est construit sans
 * contenu, il ne lâche rien à sa casse. */
export class InvalidPropContentWarning extends Schema.TaggedError<InvalidPropContentWarning>()(
  "InvalidPropContentWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `door_*` dont `extras.mouvement` n'est pas une valeur connue — jamais
 * bloquant : la porte est construite avec `DEFAULT_DOOR_MOVEMENT` (même
 * règle que `matiere` sur un `prop_*`). */
export class UnknownDoorMovementWarning extends Schema.TaggedError<UnknownDoorMovementWarning>()(
  "UnknownDoorMovementWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `vitre_*` dont `extras.pv` n'est pas un nombre strictement positif —
 * jamais bloquant : la vitre est construite INCASSABLE (même règle que `pv`
 * sur un `prop_*`). */
export class InvalidVitrePvWarning extends Schema.TaggedError<InvalidVitrePvWarning>()(
  "InvalidVitrePvWarning",
  { name: Schema.String, value: Schema.String },
) {}

export class UnknownSanitaireKindWarning extends Schema.TaggedError<UnknownSanitaireKindWarning>()(
  "UnknownSanitaireKindWarning",
  { name: Schema.String, value: Schema.String },
) {}

export class InvalidSanitairePvWarning extends Schema.TaggedError<InvalidSanitairePvWarning>()(
  "InvalidSanitairePvWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `ecran_*` dont `extras.chaine` n'est pas une chaîne connue — repli sur
 * `DEFAULT_ECRAN_CHAINE`, même règle que `sorte` sur un `sanitaire_*`. */
export class UnknownEcranChaineWarning extends Schema.TaggedError<UnknownEcranChaineWarning>()(
  "UnknownEcranChaineWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `ecran_*` dont `extras.pv` n'est pas un nombre strictement positif — jamais
 * bloquant, même règle que `pv` sur un `vitre_*`/`sanitaire_*`. */
export class InvalidEcranPvWarning extends Schema.TaggedError<InvalidEcranPvWarning>()(
  "InvalidEcranPvWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `col_hull_*` dont `RAPIER.ColliderDesc.convexHull` retourne `null`
 * (sommets dégénérés) — toujours suivi d'un repli sur un collider trimesh
 * pour ce même mesh, jamais d'absence totale de collider. */
export class DegenerateConvexHullError extends Schema.TaggedError<DegenerateConvexHullError>()(
  "DegenerateConvexHullError",
  { name: Schema.String },
) {}

export class LevelFetchError extends Schema.TaggedError<LevelFetchError>()("LevelFetchError", {
  url: Schema.String,
  cause: Schema.Defect(),
}) {}

function formatMissingColliderGeometry(error: MissingColliderGeometryError): string {
  const detail = error.reason === "missing-geometry" ? "sans géométrie valide" : "a 0 triangle";
  return `[level] "${error.name}" (${error.prefixLabel}) ${detail} — aucun collider créé.`;
}

function formatOversizedCollider(error: OversizedColliderWarning): string {
  return (
    `[level] "${error.name}" (col_*) : ${error.triangleCount} triangles, au-delà du seuil de ` +
    `${MAX_COLLIDER_TRIANGLES} — signe probable d'un mesh oublié en high-poly. ` +
    `Collider créé quand même.`
  );
}

function formatMissingSpawnPlayer(): string {
  return "[level] spawn_player absent du niveau — le joueur ne peut pas être positionné au chargement.";
}

function formatDuplicateSpawnPlayer(error: DuplicateSpawnPlayerError): string {
  return `[level] spawn_player en double (${error.count} occurrences) — seule la première rencontrée est utilisée.`;
}

function formatNonBoxTrigger(error: NonBoxTriggerError): string {
  return `[level] "${error.name}" (trig_*) n'est pas une géométrie box — trigger ignoré.`;
}

function formatUntargetedUseObject(error: UntargetedUseObjectWarning): string {
  return (
    `[level] "${error.name}" (use_*) n'a pas de cible référencée dans ses extras ` +
    `(custom property Blender "target" attendue) — objet interactif sans effet exploitable.`
  );
}

function formatUnknownLoyaltyCard(error: UnknownLoyaltyCardWarning): string {
  return (
    `[level] "${error.name}" (use_*) : propriété "${error.property}" = "${error.value}", ` +
    `qui n'est pas une carte de fidélité connue (${LOYALTY_CARDS.join(", ")}) — propriété ignorée.`
  );
}

function formatInvalidHealAmount(error: InvalidHealAmountWarning): string {
  const unite = error.property === "soin" ? "PV" : "munitions";
  return (
    `[level] "${error.name}" (use_*) : propriété "${error.property}" = "${error.value}", ` +
    `qui n'est pas un nombre de ${unite} strictement positif — propriété ignorée.`
  );
}

function formatUnknownFoodItem(error: UnknownFoodItemWarning): string {
  return (
    `[level] "${error.name}" (use_*) : propriété "aliment" = "${error.value}", ` +
    `qui n'est pas un aliment connu (${FOOD_ITEMS.join(", ")}) — propriété ignorée.`
  );
}

function formatUnknownPropMaterial(error: UnknownPropMaterialWarning): string {
  return (
    `[level] "${error.name}" (prop_*) : propriété "matiere" = "${error.value}", ` +
    `qui n'est pas une matière connue (${PROP_MATERIALS.join(", ")}) — ` +
    `repli sur "${DEFAULT_PROP_MATERIAL}".`
  );
}

function formatInvalidPropNumber(error: InvalidPropNumberWarning): string {
  const repli =
    error.property === "masse"
      ? `repli sur ${DEFAULT_PROP_MASS_KG} kg`
      : "prop laissé indestructible";
  return (
    `[level] "${error.name}" (prop_*) : propriété "${error.property}" = "${error.value}", ` +
    `qui n'est pas un nombre strictement positif — ${repli}.`
  );
}

function formatInvalidPropContent(error: InvalidPropContentWarning): string {
  return (
    `[level] "${error.name}" (prop_*) : propriété "contenu" = "${error.value}", ` +
    `qui n'est pas au format "nom:nombre" (nombre entier > 0) — prop laissé sans contenu.`
  );
}

function formatUnknownDoorMovement(error: UnknownDoorMovementWarning): string {
  return (
    `[level] "${error.name}" (door_*) : propriété "mouvement" = "${error.value}", ` +
    `qui n'est pas un mouvement connu (${DOOR_MOVEMENTS.join(", ")}) — repli sur "${DEFAULT_DOOR_MOVEMENT}".`
  );
}

function formatInvalidVitrePv(error: InvalidVitrePvWarning): string {
  return (
    `[level] "${error.name}" (vitre_*) : propriété "pv" = "${error.value}", ` +
    `qui n'est pas un nombre strictement positif — vitre laissée incassable.`
  );
}

function formatUnknownSanitaireKind(error: UnknownSanitaireKindWarning): string {
  return (
    `[level] "${error.name}" (sanitaire_*) : propriété "sorte" = "${error.value}", ` +
    `qui n'est pas une sorte connue (${SANITAIRE_KINDS.join(", ")}), et OBLIGATOIRE — ` +
    `repli sur "${DEFAULT_SANITAIRE_KIND}".`
  );
}

function formatInvalidSanitairePv(error: InvalidSanitairePvWarning): string {
  return (
    `[level] "${error.name}" (sanitaire_*) : propriété "pv" = "${error.value}", ` +
    `qui n'est pas un nombre strictement positif — sanitaire laissé incassable (au tir du joueur).`
  );
}

function formatUnknownEcranChaine(error: UnknownEcranChaineWarning): string {
  return (
    `[level] "${error.name}" (ecran_*) : propriété "chaine" = "${error.value}", ` +
    `qui n'est pas une chaîne connue (${ECRAN_CHAINES.join(", ")}) — repli sur "${DEFAULT_ECRAN_CHAINE}".`
  );
}

function formatInvalidEcranPv(error: InvalidEcranPvWarning): string {
  return (
    `[level] "${error.name}" (ecran_*) : propriété "pv" = "${error.value}", ` +
    `qui n'est pas un nombre strictement positif — écran laissé incassable.`
  );
}

function formatDegenerateConvexHull(error: DegenerateConvexHullError): string {
  return (
    `[level] "${error.name}" (col_hull_*) : hull convexe dégénéré ` +
    `(RAPIER.ColliderDesc.convexHull a retourné null, sommets probablement coplanaires) ` +
    `— repli sur un collider trimesh pour ce mesh.`
  );
}

// Conversion des matériaux glTF vers le rendu rétro.
// see: docs/archive/systems-rendu.md#invariant-5-reconversion-depuis-gltfloader

function toLambert(mat: THREE.Material, hasVertexColors: boolean, resources: LevelResources): THREE.MeshLambertMaterial {
  const src = mat as THREE.MeshStandardMaterial;
  const lambert = resources.material(new THREE.MeshLambertMaterial({
    color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
    map: src.map ?? null,
    transparent: src.transparent,
    opacity: src.opacity,
    side: src.side,
    alphaTest: src.alphaTest,
    vertexColors: hasVertexColors,
    // Le décor Lambert ignore les cartes PBR ; les effets TSL sont posés ensuite.
  }));
  lambert.name = mat.name;
  if (lambert.map) {
    // Invariant #4 : `NearestFilter` à l'AGRANDISSEMENT, toujours — c'est lui
    // qui fait le gros pixel franc. La réduction (les surfaces vues de loin)
    // suit le mode courant : voir `configureRetroTexture` et l'ADR 0027.
    configureRetroTexture(lambert.map);
  }
  return lambert;
}

function convertToLambert(mesh: THREE.Mesh, resources: LevelResources): void {
  const hasVertexColors = mesh.geometry.hasAttribute("color");
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((mat) => toLambert(mat, hasVertexColors, resources));
  } else {
    mesh.material = toLambert(mesh.material, hasVertexColors, resources);
  }
}

// see: docs/archive/pipeline-niveau-blender.md#le-nom-tel-que-tapé-dans-blender
function blenderName(obj: THREE.Object3D): string {
  const raw = (obj.userData as Record<string, unknown> | undefined)?.name;
  return typeof raw === "string" ? raw : obj.name;
}

/** Copie de `userData` pour `extras`, SANS la clé `name` que `GLTFLoader` y
 * injecte lui-même (voir `blenderName`) — ce n'est pas une custom property
 * Blender, l'exposer polluerait `extras.target`/`extras.hp`/etc. */
function cleanExtras(obj: THREE.Object3D): Record<string, unknown> {
  const { name: _internalName, ...rest } = obj.userData as Record<string, unknown>;
  return rest;
}

// see: docs/archive/systems-rendu.md#éclairage-hybride-lampes-temps-réel-ombre-cuite
function buildLevelLight(obj: THREE.Object3D, name: string): THREE.PointLight {
  const extras = cleanExtras(obj);
  const read = (key: string, fallback: number): number => {
    const value = extras[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };
  const color = typeof extras.color === "string" ? extras.color : "#ffffff";
  const light = new THREE.PointLight(
    new THREE.Color(color),
    read("intensity", 8),
    read("distance", 12),
    read("decay", 2),
  );
  light.name = name;
  obj.getWorldPosition(light.position);
  return light;
}

// Géométrie monde — voir le piège des transforms.
// see: docs/archive/pipeline-niveau-blender.md#extraction-et-le-piège-des-transforms

function worldSpaceGeometry(mesh: THREE.Mesh, resources: LevelResources): THREE.BufferGeometry {
  const geo = resources.geometry(mesh.geometry.clone());
  geo.applyMatrix4(mesh.matrixWorld);
  return geo;
}

function buildSequentialIndex(vertexCount: number): Uint32Array {
  const idx = new Uint32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) idx[i] = i;
  return idx;
}

// see: docs/archive/pipeline-niveau-blender.md#hiérarchie-des-colliders
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

function buildStaticColliderEffect(
  mesh: THREE.Mesh,
  name: string,
  prefixLabel: "col_*" | "col_hull_*",
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
  resources: LevelResources,
): Effect.Effect<boolean, MissingColliderGeometryError> {
  return Effect.gen(function* () {
    const worldGeometry = worldSpaceGeometry(mesh, resources);
    const positionAttr = worldGeometry.getAttribute("position") as THREE.BufferAttribute | undefined;

    if (!positionAttr || positionAttr.count === 0) {
      worldGeometry.dispose();
      return yield* new MissingColliderGeometryError({ name, prefixLabel, reason: "missing-geometry" });
    }

    const indexAttr = worldGeometry.getIndex();
    const rawIndices = indexAttr ? indexAttr.array : buildSequentialIndex(positionAttr.count);
    const triangleCount = Math.floor(rawIndices.length / 3);

    if (triangleCount === 0) {
      worldGeometry.dispose();
      return yield* new MissingColliderGeometryError({ name, prefixLabel, reason: "zero-triangles" });
    }
    if (triangleCount > MAX_COLLIDER_TRIANGLES) {
      // Avertissement non bloquant : loggué immédiatement, la construction continue juste après.
      yield* Effect.fail(new OversizedColliderWarning({ name, triangleCount })).pipe(
        Effect.catch((error) => Effect.sync(() => console.error(formatOversizedCollider(error)))),
      );
    }

    const vertices =
      positionAttr.array instanceof Float32Array
        ? positionAttr.array
        : Float32Array.from(positionAttr.array as ArrayLike<number>);
    const indices = rawIndices instanceof Uint32Array ? rawIndices : Uint32Array.from(rawIndices as ArrayLike<number>);

    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    bodies.push(body);
    physics.world.createCollider(
      RAPIER.ColliderDesc.trimesh(vertices, indices).setCollisionGroups(COLLISION_GROUPS.WORLD),
      body,
    );

    worldGeometry.dispose();
    return true;
  });
}

/** Version rattrapée de `buildStaticColliderEffect` : ne fait jamais échouer
 * l'appelant, logue et retourne `false` (comme l'ancien retour booléen) sur
 * `MissingColliderGeometryError`. */
function buildStaticColliderSafe(
  mesh: THREE.Mesh,
  name: string,
  prefixLabel: "col_*" | "col_hull_*",
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
  resources: LevelResources,
): Effect.Effect<boolean> {
  return buildStaticColliderEffect(mesh, name, prefixLabel, physics, bodies, resources).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        console.error(formatMissingColliderGeometry(error));
        return false;
      }),
    ),
  );
}

function buildCuboidCollider(mesh: THREE.Mesh, physics: PhysicsWorld, bodies: RAPIER.RigidBody[]): void {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);
  const localCenter = new THREE.Vector3().addVectors(bb.min, bb.max).multiplyScalar(0.5);

  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  const discardedPosition = new THREE.Vector3();
  mesh.matrixWorld.decompose(discardedPosition, worldQuat, worldScale);

  const worldCenter = localCenter.clone().applyMatrix4(mesh.matrixWorld);
  const halfExtents = new THREE.Vector3(
    Math.max(1e-3, Math.abs((localSize.x * worldScale.x) / 2)),
    Math.max(1e-3, Math.abs((localSize.y * worldScale.y) / 2)),
    Math.max(1e-3, Math.abs((localSize.z * worldScale.z) / 2)),
  );

  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(worldCenter.x, worldCenter.y, worldCenter.z)
      .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w }),
  );
  bodies.push(body);
  physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setCollisionGroups(
      COLLISION_GROUPS.WORLD,
    ),
    body,
  );

}

function buildConvexHullColliderEffect(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
  resources: LevelResources,
): Effect.Effect<"convexHull", MissingColliderGeometryError | DegenerateConvexHullError> {
  return Effect.gen(function* () {
    const worldGeometry = worldSpaceGeometry(mesh, resources);
    const positionAttr = worldGeometry.getAttribute("position") as THREE.BufferAttribute | undefined;

    if (!positionAttr || positionAttr.count === 0) {
      worldGeometry.dispose();
      return yield* new MissingColliderGeometryError({ name, prefixLabel: "col_hull_*", reason: "missing-geometry" });
    }

    const points =
      positionAttr.array instanceof Float32Array
        ? positionAttr.array
        : Float32Array.from(positionAttr.array as ArrayLike<number>);
    worldGeometry.dispose();

    const desc = RAPIER.ColliderDesc.convexHull(points);
    if (!desc) {
      return yield* new DegenerateConvexHullError({ name });
    }

    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    bodies.push(body);
    physics.world.createCollider(desc.setCollisionGroups(COLLISION_GROUPS.WORLD), body);

    return "convexHull" as const;
  });
}

/** Version rattrapée de `buildConvexHullColliderEffect` : géométrie
 * manquante -> `null` ; hull dégénéré -> repli trimesh via
 * `buildStaticColliderSafe`. */
function buildConvexHullColliderSafe(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
  resources: LevelResources,
): Effect.Effect<"convexHull" | "trimesh" | null> {
  return buildConvexHullColliderEffect(mesh, name, physics, bodies, resources).pipe(
    Effect.catchTags({
      MissingColliderGeometryError: (error) =>
        Effect.sync(() => {
          console.error(formatMissingColliderGeometry(error));
          return null;
        }),
      DegenerateConvexHullError: (error) =>
        Effect.gen(function* () {
          console.error(formatDegenerateConvexHull(error));
          // Label "col_*" volontaire (pas "col_hull_*") : fidèle au message
          // historique du repli trimesh, jamais paramétré par le préfixe réel.
          const created = yield* buildStaticColliderSafe(mesh, name, "col_*", physics, bodies, resources);
          return created ? ("trimesh" as const) : null;
        }),
    }),
  );
}

/** `spawn_player` (Empty) : position + yaw. Voir la doc de `SpawnPoint` pour
 * la convention pieds/yeux. */
function extractSpawnPoint(obj: THREE.Object3D): SpawnPoint {
  const position = new THREE.Vector3();
  obj.getWorldPosition(position);

  const worldQuat = new THREE.Quaternion();
  obj.getWorldQuaternion(worldQuat);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat);
  // Convention yaw=0 -> avant = -Z, voir SpawnPoint.yaw.
  const yaw = Math.atan2(-forward.x, -forward.z);

  return { position, yaw };
}

/** `trig_*` : volume box, sensor Rapier. Version "brute" : échoue avec
 * `NonBoxTriggerError` si la géométrie n'est pas une box — voir
 * `buildTriggerSafe` pour la version rattrapée. */
function buildTriggerEffect(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<TriggerVolume, NonBoxTriggerError> {
  return Effect.gen(function* () {
    if (!isAxisAlignedBox(mesh.geometry)) {
      return yield* new NonBoxTriggerError({ name });
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
    bodies.push(body);
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setSensor(true)
        .setCollisionGroups(COLLISION_GROUPS.TRIGGER),
      body,
    );

    return {
      name,
      object: mesh,
      min: worldCenter.clone().sub(halfExtents),
      max: worldCenter.clone().add(halfExtents),
      extras: cleanExtras(mesh),
    };
  });
}

/** Version rattrapée de `buildTriggerEffect` : logue et retourne `null` sur
 * `NonBoxTriggerError`. */
function buildTriggerSafe(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<TriggerVolume | null> {
  return buildTriggerEffect(mesh, name, physics, bodies).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        console.error(formatNonBoxTrigger(error));
        return null;
      }),
    ),
  );
}

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

function buildDoorEffect(
  mesh: THREE.Mesh,
  name: string,
  root: THREE.Object3D,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
  clips: THREE.AnimationClip[],
): Effect.Effect<DoorInfo> {
  return Effect.gen(function* () {
    const extras = cleanExtras(mesh);
    const movement = yield* readDoorMovement(name, extras.mouvement);

    root.attach(mesh);
    mesh.updateMatrixWorld(true);

    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    const localMin = bb.min.clone();
    const localMax = bb.max.clone();
    const localCenter = new THREE.Vector3().addVectors(localMin, localMax).multiplyScalar(0.5);
    const localSize = new THREE.Vector3().subVectors(localMax, localMin);

    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    const discardedPosition = new THREE.Vector3();
    mesh.matrixWorld.decompose(discardedPosition, worldQuat, worldScale);
    const worldCenter = localCenter.clone().applyMatrix4(mesh.matrixWorld);

    const halfExtents = new THREE.Vector3(
      Math.max(1e-3, Math.abs((localSize.x * worldScale.x) / 2)),
      Math.max(1e-3, Math.abs((localSize.y * worldScale.y) / 2)),
      Math.max(1e-3, Math.abs((localSize.z * worldScale.z) / 2)),
    );

    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(worldCenter.x, worldCenter.y, worldCenter.z)
        .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w }),
    );
    bodies.push(body);
    const collider = physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setCollisionGroups(
        COLLISION_GROUPS.WORLD,
      ),
      body,
    );

    return {
      name,
      object: mesh,
      body,
      collider,
      halfExtents,
      localMin,
      localMax,
      closedPosition: mesh.position.clone(),
      closedQuaternion: mesh.quaternion.clone(),
      scale: mesh.scale.clone(),
      movement,
      clip: findClipForObject(clips, mesh),
      extras,
    };
  });
}

function buildVitreCandidateEffect(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<VitreCandidate> {
  return Effect.gen(function* () {
    const extras = cleanExtras(mesh);
    const solide = extras.solide !== false;
    const maxHp = solide ? yield* readVitrePv(name, extras.pv) : null;
    const givre = extras.givre === true;
    let matiere: PropMaterial = "verre";
    if (extras.matiere !== undefined && extras.matiere !== null && extras.matiere !== "") {
      const parsed = parsePropMaterial(extras.matiere);
      if (parsed) matiere = parsed;
      else console.error(
        `[level] "${name}" (vitre_*) : propriété "matiere" = "${String(extras.matiere)}" ` +
        `inconnue (${PROP_MATERIALS.join(", ")}) — défaut "verre".`,
      );
    }

    const material = mesh.material as THREE.MeshLambertMaterial;
    material.side = THREE.DoubleSide;
    material.depthWrite = false;

    let collider: RAPIER.Collider | null = null;
    let body: RAPIER.RigidBody | null = null;
    if (solide) {
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox!;
      const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);
      const localCenter = new THREE.Vector3().addVectors(bb.min, bb.max).multiplyScalar(0.5);

      const worldQuat = new THREE.Quaternion();
      const worldScale = new THREE.Vector3();
      const discardedPosition = new THREE.Vector3();
      mesh.matrixWorld.decompose(discardedPosition, worldQuat, worldScale);
      const worldCenter = localCenter.clone().applyMatrix4(mesh.matrixWorld);

      const halfExtents = new THREE.Vector3(
        Math.max(1e-3, Math.abs((localSize.x * worldScale.x) / 2)),
        Math.max(1e-3, Math.abs((localSize.y * worldScale.y) / 2)),
        Math.max(1e-3, Math.abs((localSize.z * worldScale.z) / 2)),
      );

      body = physics.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(worldCenter.x, worldCenter.y, worldCenter.z)
          .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w }),
      );
      bodies.push(body);
      collider = physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setCollisionGroups(
          COLLISION_GROUPS.WORLD,
        ),
        body,
      );

    }

    return {
      name,
      mesh: mesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>,
      collider,
      body,
      maxHp,
      matiere,
      givre,
      extras,
    };
  });
}

function readSanitaireKind(name: string, raw: unknown): Effect.Effect<SanitaireKind> {
  return Effect.gen(function* () {
    const sorte = parseSanitaireKind(raw);
    if (sorte) return sorte;
    const value = raw === undefined || raw === null || raw === "" ? "(absent)" : String(raw);
    yield* Effect.fail(new UnknownSanitaireKindWarning({ name, value })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatUnknownSanitaireKind(error)))),
    );
    return DEFAULT_SANITAIRE_KIND;
  });
}

/** Lit `pv` d'un `sanitaire_*` : absent -> `null` (incassable au tir du
 * joueur) sans bruit, présent mais pas un nombre strictement positif ->
 * `null` AVEC avertissement bruyant (même règle que `pv` sur un `vitre_*`). */
function readSanitairePv(name: string, raw: unknown): Effect.Effect<number | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
    yield* Effect.fail(new InvalidSanitairePvWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatInvalidSanitairePv(error)))),
    );
    return null;
  });
}

// see: docs/archive/reference-conventions-nommage.md#préfixe-sanitaire
function buildSanitaireCandidateEffect(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<SanitaireCandidate> {
  return Effect.gen(function* () {
    const extras = cleanExtras(mesh);
    const kind = yield* readSanitaireKind(name, extras.sorte);
    const maxHp = yield* readSanitairePv(name, extras.pv);

    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);
    const localCenter = new THREE.Vector3().addVectors(bb.min, bb.max).multiplyScalar(0.5);

    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    const discardedPosition = new THREE.Vector3();
    mesh.matrixWorld.decompose(discardedPosition, worldQuat, worldScale);
    const worldCenter = localCenter.clone().applyMatrix4(mesh.matrixWorld);

    const halfExtents = new THREE.Vector3(
      Math.max(1e-3, Math.abs((localSize.x * worldScale.x) / 2)),
      Math.max(1e-3, Math.abs((localSize.y * worldScale.y) / 2)),
      Math.max(1e-3, Math.abs((localSize.z * worldScale.z) / 2)),
    );

    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(worldCenter.x, worldCenter.y, worldCenter.z)
        .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w }),
    );
    bodies.push(body);
    const collider = physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setCollisionGroups(
        COLLISION_GROUPS.WORLD,
      ),
      body,
    );

    const worldMin = worldCenter.clone().sub(halfExtents);
    const worldMax = worldCenter.clone().add(halfExtents);
    const jetOrigin = new THREE.Vector3((worldMin.x + worldMax.x) / 2, worldMin.y, (worldMin.z + worldMax.z) / 2);

    return {
      name,
      mesh: mesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>,
      collider,
      body,
      kind,
      maxHp,
      jetOrigin,
      extras,
    };
  });
}

/** Lit `chaine` d'un `ecran_*` : OBLIGATOIRE (comme `sorte` sur un
 * `sanitaire_*`), absente ou inconnue -> avertissement bruyant, repli sur
 * `DEFAULT_ECRAN_CHAINE`. */
function readEcranChaine(name: string, raw: unknown): Effect.Effect<EcranChaine> {
  return Effect.gen(function* () {
    const chaine = parseEcranChaine(raw);
    if (chaine) return chaine;
    const value = raw === undefined || raw === null || raw === "" ? "(absente)" : String(raw);
    yield* Effect.fail(new UnknownEcranChaineWarning({ name, value })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatUnknownEcranChaine(error)))),
    );
    return DEFAULT_ECRAN_CHAINE;
  });
}

/** Lit `pv` d'un `ecran_*` : absent -> `null` (incassable) sans bruit,
 * présent mais pas un nombre strictement positif -> `null` AVEC avertissement
 * bruyant, même règle que `pv` sur un `vitre_*`/`sanitaire_*`. */
function readEcranPv(name: string, raw: unknown): Effect.Effect<number | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
    yield* Effect.fail(new InvalidEcranPvWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatInvalidEcranPv(error)))),
    );
    return null;
  });
}

// see: docs/archive/reference-conventions-nommage.md#préfixe-ecran
function buildEcranCandidateEffect(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<EcranCandidate> {
  return Effect.gen(function* () {
    const extras = cleanExtras(mesh);
    const chaine = yield* readEcranChaine(name, extras.chaine);
    const maxHp = yield* readEcranPv(name, extras.pv);

    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);
    const localCenter = new THREE.Vector3().addVectors(bb.min, bb.max).multiplyScalar(0.5);

    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    const discardedPosition = new THREE.Vector3();
    mesh.matrixWorld.decompose(discardedPosition, worldQuat, worldScale);
    const worldCenter = localCenter.clone().applyMatrix4(mesh.matrixWorld);

    const halfExtents = new THREE.Vector3(
      Math.max(1e-3, Math.abs((localSize.x * worldScale.x) / 2)),
      Math.max(1e-3, Math.abs((localSize.y * worldScale.y) / 2)),
      Math.max(1e-3, Math.abs((localSize.z * worldScale.z) / 2)),
    );

    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(worldCenter.x, worldCenter.y, worldCenter.z)
        .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w }),
    );
    bodies.push(body);
    const collider = physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setCollisionGroups(
        COLLISION_GROUPS.WORLD,
      ),
      body,
    );

    return {
      name,
      mesh: mesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>,
      collider,
      body,
      maxHp,
      chaine,
      extras,
    };
  });
}

const DEFAULT_PROP_MASS_KG = 25;

/** Frottement/rebond d'un prop : il glisse un peu et ne rebondit pas. Un
 * caddie qui rebondit se lit comme un ballon de plage. */
const PROP_FRICTION = 0.8;
const PROP_RESTITUTION = 0;

/** Amortissements : sans eux, un prop poussé sur un sol plat garde sa vitesse
 * très longtemps (Rapier n'a pas de frottement de roulement) et traverse la
 * pièce pour un coup d'épaule. */
const PROP_LINEAR_DAMPING = 0.6;
const PROP_ANGULAR_DAMPING = 0.8;

/** Lit `matiere` : absente -> défaut sans bruit, inconnue -> défaut AVEC
 * avertissement bruyant (même règle que `card` sur un `use_*`). */
function readPropMaterial(name: string, raw: unknown): Effect.Effect<PropMaterial> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return DEFAULT_PROP_MATERIAL;
    const matiere = parsePropMaterial(raw);
    if (matiere) return matiere;
    yield* Effect.fail(new UnknownPropMaterialWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatUnknownPropMaterial(error)))),
    );
    return DEFAULT_PROP_MATERIAL;
  });
}

/** Lit `masse`/`pv` : absente -> `null` sans bruit, présente mais pas un
 * nombre > 0 -> `null` AVEC avertissement bruyant. */
function readPropNumber(name: string, property: string, raw: unknown): Effect.Effect<number | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
    yield* Effect.fail(new InvalidPropNumberWarning({ name, property, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatInvalidPropNumber(error)))),
    );
    return null;
  });
}

/** Lit `mouvement` d'un `door_*` : absent -> `DEFAULT_DOOR_MOVEMENT` sans
 * bruit, présent mais inconnu -> `DEFAULT_DOOR_MOVEMENT` AVEC avertissement
 * bruyant (même règle que `matiere` sur un `prop_*`). */
function readDoorMovement(name: string, raw: unknown): Effect.Effect<DoorMovement> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return DEFAULT_DOOR_MOVEMENT;
    const mouvement = parseDoorMovement(raw);
    if (mouvement) return mouvement;
    yield* Effect.fail(new UnknownDoorMovementWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatUnknownDoorMovement(error)))),
    );
    return DEFAULT_DOOR_MOVEMENT;
  });
}

/** Lit `pv` d'un `vitre_*` : absent -> `null` (incassable) sans bruit,
 * présent mais pas un nombre strictement positif -> `null` AVEC
 * avertissement bruyant (même règle que `pv` sur un `prop_*`). */
function readVitrePv(name: string, raw: unknown): Effect.Effect<number | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
    yield* Effect.fail(new InvalidVitrePvWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatInvalidVitrePv(error)))),
    );
    return null;
  });
}

/** Format attendu de `contenu` : `"nom:nombre"`, nombre entier strictement
 * positif — voir `PropInfo.contenu`. */
const PROP_CONTENT_PATTERN = /^([a-z_]+):(\d+)$/i;

function readPropContent(name: string, raw: unknown): Effect.Effect<{ item: string; count: number } | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const match = PROP_CONTENT_PATTERN.exec(String(raw).trim());
    const count = match ? Number(match[2]) : NaN;
    if (match && Number.isFinite(count) && count > 0) {
      return { item: match[1]!.toLowerCase(), count };
    }
    yield* Effect.fail(new InvalidPropContentWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatInvalidPropContent(error)))),
    );
    return null;
  });
}

// see: docs/archive/reference-conventions-nommage.md#props-physiques
function buildPropEffect(
  mesh: THREE.Mesh,
  name: string,
  root: THREE.Object3D,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<PropInfo> {
  return Effect.gen(function* () {
    const extras = cleanExtras(mesh);
    const matiere = yield* readPropMaterial(name, extras.matiere);
    const masse = yield* readPropNumber(name, "masse", extras.masse);
    const maxHp = yield* readPropNumber(name, "pv", extras.pv);
    const contenu = yield* readPropContent(name, extras.contenu);

    root.attach(mesh);
    mesh.updateMatrixWorld(true);

    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);
    const centerOffset = new THREE.Vector3().addVectors(bb.min, bb.max).multiplyScalar(0.5);

    const worldPosition = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    mesh.matrixWorld.decompose(worldPosition, worldQuat, worldScale);
    const worldCenter = centerOffset.clone().applyMatrix4(mesh.matrixWorld);

    const halfExtents = new THREE.Vector3(
      Math.max(1e-3, Math.abs((localSize.x * worldScale.x) / 2)),
      Math.max(1e-3, Math.abs((localSize.y * worldScale.y) / 2)),
      Math.max(1e-3, Math.abs((localSize.z * worldScale.z) / 2)),
    );

    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(worldCenter.x, worldCenter.y, worldCenter.z)
        .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w })
        .setLinearDamping(PROP_LINEAR_DAMPING)
        .setAngularDamping(PROP_ANGULAR_DAMPING)
        // Un plomb de pompe transmet une impulsion franche à un objet léger :
        // sans CCD, un prop peut traverser un sol de 20 cm en un seul pas fixe.
        .setCcdEnabled(true),
    );
    bodies.push(body);
    const collider = physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setMass(masse ?? DEFAULT_PROP_MASS_KG)
        .setFriction(PROP_FRICTION)
        .setRestitution(PROP_RESTITUTION)
        .setCollisionGroups(COLLISION_GROUPS.PROP),
      body,
    );

    return { name, object: mesh, body, collider, halfExtents, centerOffset, maxHp, matiere, contenu, extras };
  });
}

// see: docs/archive/pipeline-niveau-blender.md#objets-interactifs
/** Lit une propriété de carte (`card`/`requires`) : absente -> `null` sans
 * bruit, présente mais inconnue -> `null` AVEC avertissement bruyant. */
function readCardProperty(name: string, property: string, raw: unknown): Effect.Effect<LoyaltyCard | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const card = parseLoyaltyCard(raw);
    if (card) return card;
    yield* Effect.fail(new UnknownLoyaltyCardWarning({ name, property, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatUnknownLoyaltyCard(error)))),
    );
    return null;
  });
}

/** Lit une quantité (`soin`, `munitions`) : absente -> `null` sans bruit,
 * présente mais pas un nombre > 0 -> `null` AVEC avertissement bruyant (même
 * règle que les cartes). */
function readAmountProperty(name: string, property: string, raw: unknown): Effect.Effect<number | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const amount = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(amount) && amount > 0) return amount;
    yield* Effect.fail(new InvalidHealAmountWarning({ name, value: String(raw), property })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatInvalidHealAmount(error)))),
    );
    return null;
  });
}

/** Lit `aliment` : absente -> `null` sans bruit, présente mais inconnue ->
 * `null` AVEC avertissement bruyant (même règle que `card`/`requires`). */
function readFoodItem(name: string, raw: unknown): Effect.Effect<FoodItem | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const item = parseFoodItem(raw);
    if (item) return item;
    yield* Effect.fail(new UnknownFoodItemWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatUnknownFoodItem(error)))),
    );
    return null;
  });
}

function buildUseObjectEffect(mesh: THREE.Mesh, name: string): Effect.Effect<UseObject> {
  return Effect.gen(function* () {
    const position = new THREE.Vector3();
    mesh.getWorldPosition(position);

    const extras = cleanExtras(mesh);
    const targetName = typeof extras.target === "string" ? extras.target : null;
    const grantsCard = yield* readCardProperty(name, "card", extras.card);
    const requiresCard = yield* readCardProperty(name, "requires", extras.requires);
    const explicitHeals = yield* readAmountProperty(name, "soin", extras.soin);
    const ammo = yield* readAmountProperty(name, "munitions", extras.munitions);
    const aliment = yield* readFoodItem(name, extras.aliment);
    const heals = explicitHeals ?? (aliment ? FOOD_HEAL_AMOUNTS[aliment] : null);
    const cameras =
      typeof extras.cameras === "string"
        ? extras.cameras.split(",").map((c) => c.trim()).filter((c) => c.length > 0)
        : null;

    // Une carte, une trousse, un aliment, une console ou un objet câblé par
    // nom se suffit à lui-même : pas de cible, donc pas d'avertissement.
    if (
      !targetName &&
      !grantsCard &&
      heals === null &&
      ammo === null &&
      !cameras &&
      !NAME_WIRED_USE_OBJECTS.has(name)
    ) {
      yield* Effect.fail(new UntargetedUseObjectWarning({ name })).pipe(
        Effect.catch((error) => Effect.sync(() => console.error(formatUntargetedUseObject(error)))),
      );
    }

    return { name, object: mesh, position, range: USE_RANGE_METERS, targetName, grantsCard, requiresCard, heals, ammo, aliment, cameras, extras };
  });
}

/** `secret_*` : même traitement géométrique qu'un `trig_*` (bounding box
 * monde), mais AUCUNE exigence de forme box — un secret peut être une zone
 * irrégulière, sa détection appartient à `interactive.ts`, pas à ce loader. */
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

/** Validation post-traversal du nombre de `spawn_player` rencontrés — même
 * patron "fail immédiatement rattrapé" que les cas par-mesh ci-dessus, juste
 * exécuté une fois après la boucle plutôt que par nœud. */
function validateSpawnPlayerCountEffect(count: number): Effect.Effect<void> {
  if (count === 0) {
    return Effect.fail(new MissingSpawnPlayerError({})).pipe(
      Effect.catch(() => Effect.sync(() => console.error(formatMissingSpawnPlayer()))),
    );
  }
  if (count > 1) {
    return Effect.fail(new DuplicateSpawnPlayerError({ count })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatDuplicateSpawnPlayer(error)))),
    );
  }
  return Effect.void;
}

// Point d'entrée.

interface LevelResource extends Omit<LevelHandle, "dispose" | "suspend"> {
  readonly bodies: readonly RAPIER.RigidBody[];
}

function buildLevelResourceEffect(
  gltf: GLTF,
  scene: THREE.Scene,
  physics: PhysicsWorld,
  resources: LevelResources,
): Effect.Effect<LevelResource> {
  return Effect.gen(function* () {
    const root = gltf.scene;
    scene.add(root);
    // Un seul passage sur tout le sous-arbre AVANT toute lecture de matrixWorld.
    root.updateWorldMatrix(true, true);

    const nodes: THREE.Object3D[] = [];
    root.traverse((obj) => nodes.push(obj));

    const bodies = resources.bodies;

    let spawnPlayer: SpawnPoint | null = null;
    let spawnPlayerCount = 0;
    const spawnSuits: NamedSpawn[] = [];
    const lights: THREE.PointLight[] = [];
    const spawnDirectors: NamedSpawn[] = [];
    const triggers: TriggerVolume[] = [];
    const doors: DoorInfo[] = [];
    const props: PropInfo[] = [];
    const vitreCandidates: VitreCandidate[] = [];
    const sanitaireCandidates: SanitaireCandidate[] = [];
    const ecranCandidates: EcranCandidate[] = [];
    const cams: CamPoint[] = [];
    const useObjects: UseObject[] = [];
    const secrets: SecretZone[] = [];

    let colliderCount = 0;
    const colliderKindCounts = { cuboid: 0, convexHull: 0, trimesh: 0 };
    let unprefixedMeshCount = 0;

    // Un mesh sous une porte, un prop physique ou un objet interactif, ou visé
    // par une animation, bouge ou doit rester adressable : il ne rejoint jamais
    // un lot fusionné.
    const movableRoots = new Set(
      nodes.filter((o) => {
        const n = blenderName(o);
        return n.startsWith("door_") || n.startsWith("use_") || n.startsWith("prop_");
      }),
    );
    const animatedNodeNames = new Set(
      gltf.animations.flatMap((clip) => clip.tracks.map((t) => THREE.PropertyBinding.parseTrackName(t.name).nodeName)),
    );
    const isMovable = (obj: THREE.Object3D): boolean => {
      for (let o: THREE.Object3D | null = obj; o && o !== root; o = o.parent) {
        if (movableRoots.has(o) || animatedNodeNames.has(o.name)) return true;
      }
      return false;
    };
    const decorCandidates: THREE.Mesh[] = [];

    for (const obj of nodes) {
      // Nom "tel que tapé dans Blender", PAS `obj.name` — voir `blenderName`.
      const name = blenderName(obj);

      // Empties : jamais un THREE.Mesh, traités avant le filtre `instanceof`.
      if (name === "spawn_player") {
        spawnPlayerCount++;
        if (spawnPlayerCount === 1) spawnPlayer = extractSpawnPoint(obj);
        continue;
      }
      if (name.startsWith("spawn_suit_")) {
        const position = new THREE.Vector3();
        obj.getWorldPosition(position);
        spawnSuits.push({ name, position });
        continue;
      }
      if (name.startsWith("light_")) {
        // Attachée à `root` et non à la scène : elle disparaît avec le niveau,
        // comme tout le reste du `.glb`.
        lights.push(buildLevelLight(obj, name));
        continue;
      }
      if (name.startsWith("spawn_director_")) {
        const position = new THREE.Vector3();
        obj.getWorldPosition(position);
        spawnDirectors.push({ name, position });
        continue;
      }
      if (name.startsWith("cam_")) {
        // Empty, jamais un mesh (voir `validate_level.py`) : position ET
        // orientation MONDE, figées à la construction.
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        obj.getWorldPosition(position);
        obj.getWorldQuaternion(quaternion);
        const label = typeof (obj.userData as Record<string, unknown>).nom === "string"
          ? ((obj.userData as Record<string, unknown>).nom as string)
          : name;
        cams.push({ name, position, quaternion, label });
        continue;
      }

      if (!(obj instanceof THREE.Mesh)) continue;

      // Invariant #5 (+ #4) : AVANT toute autre chose, pour CHAQUE mesh, préfixé ou non.
      convertToLambert(obj, resources);

      // Sous-préfixes de `col_*` testés AVANT le `col_` générique ci-dessous :
      // sinon `"col_box_test".startsWith("col_")` (vrai aussi) fait tomber le
      // routage dans le mauvais cas, silencieusement.
      if (name.startsWith("col_box_")) {
        buildCuboidCollider(obj, physics, bodies);
        colliderCount++;
        colliderKindCounts.cuboid++;
        obj.visible = false;
        continue;
      }

      if (name.startsWith("col_hull_")) {
        const kind = yield* buildConvexHullColliderSafe(obj, name, physics, bodies, resources);
        if (kind) {
          colliderCount++;
          colliderKindCounts[kind]++;
        }
        obj.visible = false;
        continue;
      }

      if (name.startsWith("col_mesh_")) {
        // Alias explicite du dernier recours (trimesh) — aucune nouvelle
        // logique, juste un branchement nommé plutôt qu'un fallthrough
        // implicite dans le `col_*` générique.
        const created = yield* buildStaticColliderSafe(obj, name, "col_*", physics, bodies, resources);
        if (created) {
          colliderCount++;
          colliderKindCounts.trimesh++;
        }
        obj.visible = false;
        continue;
      }

      if (name.startsWith("col_")) {
        // Rétrocompatibilité (Zones A/B) : trimesh, sauf boîte détectée -> cuboid.
        if (isAxisAlignedBox(obj.geometry)) {
          buildCuboidCollider(obj, physics, bodies);
          colliderCount++;
          colliderKindCounts.cuboid++;
        } else {
          const created = yield* buildStaticColliderSafe(obj, name, "col_*", physics, bodies, resources);
          if (created) {
            colliderCount++;
            colliderKindCounts.trimesh++;
          }
        }
        obj.visible = false;
        continue;
      }

      if (name.startsWith("trig_")) {
        const trigger = yield* buildTriggerSafe(obj, name, physics, bodies);
        if (trigger) triggers.push(trigger);
        obj.visible = false;
        continue;
      }

      if (name.startsWith("door_")) {
        doors.push(yield* buildDoorEffect(obj, name, root, physics, bodies, gltf.animations));
        continue; // reste visible : c'est un panneau de décor animé, pas un volume logique
      }

      if (name.startsWith("vitre_")) {
        vitreCandidates.push(yield* buildVitreCandidateEffect(obj, name, physics, bodies));
        continue; // reste visible : le rendu de la vitre EST son mesh, fusionné plus bas comme le décor
      }

      if (name.startsWith("sanitaire_")) {
        sanitaireCandidates.push(yield* buildSanitaireCandidateEffect(obj, name, physics, bodies));
        continue; // reste visible : le rendu du sanitaire EST son mesh, fusionné plus bas comme le décor
      }

      if (name.startsWith("ecran_")) {
        ecranCandidates.push(yield* buildEcranCandidateEffect(obj, name, physics, bodies));
        continue; // reste visible : le rendu de l'écran EST son mesh, fusionné plus bas comme le décor
      }

      if (name.startsWith("prop_")) {
        props.push(yield* buildPropEffect(obj, name, root, physics, bodies));
        continue; // reste visible : un prop EST son rendu, il n'a pas de proxy séparé
      }

      if (name.startsWith("use_")) {
        useObjects.push(yield* buildUseObjectEffect(obj, name));
        continue; // reste visible (objet interactif physique, ex. un terminal)
      }

      if (name.startsWith("fx_douche_")) {
        continue; // reste adressable pour l'animation et l'interrupteur d'eau
      }

      if (name.startsWith("secret_")) {
        secrets.push(buildSecretZone(obj, name));
        obj.visible = false; // volume logique, comme trig_*
        continue;
      }

      // Mesh sans préfixe reconnu : rendu tel quel, SANS collider,
      // SILENCIEUSEMENT — comportement voulu, ne rien logger ici.
      unprefixedMeshCount++;
      if (!isMovable(obj)) decorCandidates.push(obj);
    }

    // Après convertToLambert : le filet de douche remplace volontairement
    // son matériau classique par le matériau TSL ciblé (ADR 0035).
    initialiserDouches(root);
    resources.collect();

    yield* validateSpawnPlayerCountEffect(spawnPlayerCount);

    for (const light of lights) root.add(light);

    const decor = mergeStaticDecor(root, decorCandidates, resources);
    const vitreMerge = mergeVitreDecor(root, vitreCandidates, resources);
    const sanitaireMerge = mergeSanitaireDecor(root, sanitaireCandidates, resources);
    const ecranMerge = mergeEcranDecor(root, ecranCandidates, resources);
    // Vantaux regroupés par matériau (voir `batchDoorMeshes`) : un vantail
    // animé ne rejoint jamais le décor fusionné, mais vingt vantaux n'ont pas
    // à coûter vingt lots de dessin.
    const doorBatchCount = batchDoorMeshes(root, doors, resources);

    const stats: LevelStats = {
      colliderCount,
      colliderKindCounts,
      spawnSuitCount: spawnSuits.length,
      spawnDirectorCount: spawnDirectors.length,
      triggerCount: triggers.length,
      doorCount: doors.length,
      useCount: useObjects.length,
      secretCount: secrets.length,
      unprefixedMeshCount,
      decorBatchCount: unprefixedMeshCount - decor.mergedMeshCount + decor.batchCount,
      lightCount: lights.length,
      propCount: props.length,
      vitreCount: vitreMerge.vitres.length,
      vitreBatchCount: vitreMerge.batchCount,
      doorBatchCount,
      sanitaireCount: sanitaireMerge.sanitaires.length,
      sanitaireBatchCount: sanitaireMerge.batchCount,
      ecranCount: ecranMerge.ecrans.length,
      ecranBatchCount: ecranMerge.batchCount,
    };

    return {
      root,
      gltf,
      spawnPlayer,
      spawnSuits,
      spawnDirectors,
      triggers,
      doors,
      props,
      vitres: vitreMerge.vitres,
      sanitaires: sanitaireMerge.sanitaires,
      sanitaireRendus: sanitaireMerge.rendus,
      ecrans: ecranMerge.ecrans,
      cams,
      useObjects,
      secrets,
      lights,
      stats,
      bodies,
    };
  });
}

// Le finalizer existe avant le premier corps ou changement de hiérarchie.
function acquireLevelResourceEffect(
  gltf: GLTF,
  scene: THREE.Scene,
  physics: PhysicsWorld,
): Effect.Effect<LevelResource, never, Scope.Scope> {
  return Effect.gen(function* () {
    const resources = yield* Effect.acquireRelease(
      Effect.sync(() => new LevelResources(gltf.scene)),
      (owned) => Effect.sync(() => owned.dispose(physics)),
    );
    resources.collect();
    return yield* buildLevelResourceEffect(gltf, scene, physics, resources);
  });
}

function toLevelHandle(resource: LevelResource, scope: Scope.Closeable): LevelHandle {
  let restoreSuspension: (() => void) | null = null;
  return {
    root: resource.root,
    gltf: resource.gltf,
    spawnPlayer: resource.spawnPlayer,
    spawnSuits: resource.spawnSuits,
    spawnDirectors: resource.spawnDirectors,
    triggers: resource.triggers,
    doors: resource.doors,
    props: resource.props,
    vitres: resource.vitres,
    sanitaires: resource.sanitaires,
    sanitaireRendus: resource.sanitaireRendus,
    ecrans: resource.ecrans,
    cams: resource.cams,
    useObjects: resource.useObjects,
    secrets: resource.secrets,
    lights: resource.lights,
    stats: resource.stats,
    suspend: () => {
      if (restoreSuspension) return restoreSuspension;
      const rootWasVisible = resource.root.visible;
      const enabledBodies = resource.bodies.map((body) => body.isEnabled());
      resource.root.visible = false;
      for (const body of resource.bodies) body.setEnabled(false);
      let restored = false;
      restoreSuspension = () => {
        if (restored) return;
        restored = true;
        resource.root.visible = rootWasVisible;
        for (let i = 0; i < resource.bodies.length; i++) {
          resource.bodies[i]!.setEnabled(enabledBodies[i]!);
        }
        restoreSuspension = null;
      };
      return restoreSuspension;
    },
    dispose: () => GameRuntime.runSync(Scope.close(scope, Exit.void)),
  };
}

export function buildLevelFromGltfEffect(
  gltf: GLTF,
  scene: THREE.Scene,
  physics: PhysicsWorld,
): Effect.Effect<LevelHandle> {
  return Effect.gen(function* () {
    const scope = Scope.makeUnsafe();
    return yield* acquireLevelResourceEffect(gltf, scene, physics).pipe(
      Scope.provide(scope),
      Effect.map((resource) => toLevelHandle(resource, scope)),
      Effect.onExit((exit) => Exit.isFailure(exit) ? Scope.close(scope, exit) : Effect.void),
    );
  });
}

export function buildLevelFromGltf(gltf: GLTF, scene: THREE.Scene, physics: PhysicsWorld): LevelHandle {
  return GameRuntime.runSync(buildLevelFromGltfEffect(gltf, scene, physics));
}

/** Version Effect de `loadLevel`, réservée aux tests comme
 * `buildLevelFromGltfEffect`. Seule fonction de ce fichier dont le canal
 * d'erreur n'est PAS `never` — voir la doc de `LevelFetchError`. */
export function loadLevelEffect(
  url: string,
  scene: THREE.Scene,
  physics: PhysicsWorld,
  onProgress?: (fraction: number) => void,
): Effect.Effect<LevelHandle, LevelFetchError> {
  return Effect.gen(function* () {
    const loader = new GLTFLoader();
    const gltf = yield* Effect.tryPromise({
      try: () =>
        loader.loadAsync(url, (event) => {
          // `total` vaut 0 si le serveur n'annonce pas de `Content-Length`
          // (réponse en flux, compression à la volée) : dans ce cas on ne
          // sait rien, et mentir vaut moins que se taire.
          if (onProgress && event.total > 0) onProgress(event.loaded / event.total);
        }),
      catch: (cause) => new LevelFetchError({ url, cause }),
    });
    return yield* buildLevelFromGltfEffect(gltf, scene, physics);
  });
}

export async function loadLevel(
  url: string,
  scene: THREE.Scene,
  physics: PhysicsWorld,
  onProgress?: (fraction: number) => void,
): Promise<LevelHandle> {
  return GameRuntime.runPromise(loadLevelEffect(url, scene, physics, onProgress));
}
