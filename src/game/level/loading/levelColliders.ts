import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Effect } from "effect";
import { COLLISION_GROUPS, type PhysicsWorld } from "../../../physics/world";
import type { LevelResources } from "./levelResources";
import type { TriggerVolume } from "./levelTypes";
import { cleanExtras } from "./levelExtras";
import {
  MissingColliderGeometryError,
  OversizedColliderWarning,
  DegenerateConvexHullError,
  NonBoxTriggerError,
  MAX_COLLIDER_TRIANGLES,
  formatOversizedCollider,
  formatMissingColliderGeometry,
  formatDegenerateConvexHull,
  formatNonBoxTrigger,
} from "./levelDiagnostics";

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
export function isAxisAlignedBox(geometry: THREE.BufferGeometry, epsilon = 1e-4): boolean {
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
export function buildStaticColliderSafe(
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

export function buildCuboidCollider(mesh: THREE.Mesh, physics: PhysicsWorld, bodies: RAPIER.RigidBody[]): void {
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
    RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setCollisionGroups(COLLISION_GROUPS.WORLD),
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
export function buildConvexHullColliderSafe(
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
export function buildTriggerSafe(
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
