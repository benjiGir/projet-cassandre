import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Effect } from "effect";
import { COLLISION_GROUPS, type PhysicsWorld } from "../../../physics/world";
import type { SpawnPoint, UseObject, SecretZone } from "./levelTypes";
import type { DoorInfo } from "../doors/doorTypes";
import { PROP_MATERIALS, parsePropMaterial, type PropMaterial, type PropInfo } from "../props/props";
import type { VitreCandidate } from "../interactions/vitres";
import type { SanitaireCandidate } from "../sanitaires/sanitaires";
import type { EcranCandidate } from "../interactions/ecrans";
import {
  DEFAULT_PROP_MASS_KG,
  PROP_FRICTION,
  PROP_RESTITUTION,
  PROP_LINEAR_DAMPING,
  PROP_ANGULAR_DAMPING,
} from "../props/propConfig";
import { FOOD_HEAL_AMOUNTS } from "../interactions/food";
import { NAME_WIRED_USE_OBJECTS } from "../interactions/interactive";
import { UntargetedUseObjectWarning, formatUntargetedUseObject } from "./levelDiagnostics";
import {
  cleanExtras,
  readSanitaireKind,
  readSanitairePv,
  readEcranChaine,
  readEcranPv,
  readPropMaterial,
  readPropNumber,
  readDoorMovement,
  readVitrePv,
  readPropContent,
  readCardProperty,
  readAmountProperty,
  readFoodItem,
} from "./levelExtras";

/** `spawn_player` (Empty) : position + yaw. Voir la doc de `SpawnPoint` pour
 * la convention pieds/yeux. */
export function extractSpawnPoint(obj: THREE.Object3D): SpawnPoint {
  const position = new THREE.Vector3();
  obj.getWorldPosition(position);

  const worldQuat = new THREE.Quaternion();
  obj.getWorldQuaternion(worldQuat);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat);
  // Convention yaw=0 -> avant = -Z, voir SpawnPoint.yaw.
  const yaw = Math.atan2(-forward.x, -forward.z);

  return { position, yaw };
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

export function buildDoorEffect(
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

export function buildVitreCandidateEffect(
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

// see: docs/archive/reference-conventions-nommage.md#préfixe-sanitaire
export function buildSanitaireCandidateEffect(
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

// see: docs/archive/reference-conventions-nommage.md#préfixe-ecran
export function buildEcranCandidateEffect(
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

// see: docs/archive/reference-conventions-nommage.md#props-physiques
export function buildPropEffect(
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

// see: docs/6-reference/notes-code-gameplay-niveau.md#chargement-et-ressources

// see: docs/5-guides/modifier-le-niveau.md

/** Portée d'usage d'un `use_*`, mètres — voir reference/conventions-nommage.md. */
const USE_RANGE_METERS = 2;

export function buildUseObjectEffect(mesh: THREE.Mesh, name: string): Effect.Effect<UseObject> {
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
export function buildSecretZone(mesh: THREE.Mesh, name: string): SecretZone {
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
