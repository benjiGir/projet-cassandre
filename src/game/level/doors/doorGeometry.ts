import * as THREE from "three";
import type { DoorActor, DoorHinge, DoorHingeGeometry, DoorMember, DoorInfo, ParsedDoorConfig } from "./doorTypes";
import { AUTO_ALTITUDE_TOLERANCE } from "./doorConfig";

export function computeHingeGeometry(
  localMin: THREE.Vector3,
  localMax: THREE.Vector3,
  charniere: DoorHinge,
): DoorHingeGeometry {
  const sizeX = localMax.x - localMin.x;
  const sizeZ = localMax.z - localMin.z;
  const axis: "x" | "z" = sizeX >= sizeZ ? "x" : "z";
  const centerY = (localMin.y + localMax.y) / 2;

  const pivotLocal = new THREE.Vector3();
  const farLocalDir = new THREE.Vector3();
  let grandAxisLocalLength: number;

  if (axis === "x") {
    grandAxisLocalLength = sizeX;
    const centerZ = (localMin.z + localMax.z) / 2;
    const pivotX = charniere === "min" ? localMin.x : localMax.x;
    const farX = charniere === "min" ? localMax.x : localMin.x;
    pivotLocal.set(pivotX, centerY, centerZ);
    farLocalDir.set(farX - pivotX, 0, 0);
  } else {
    grandAxisLocalLength = sizeZ;
    const centerX = (localMin.x + localMax.x) / 2;
    const pivotZ = charniere === "min" ? localMin.z : localMax.z;
    const farZ = charniere === "min" ? localMax.z : localMin.z;
    pivotLocal.set(centerX, centerY, pivotZ);
    farLocalDir.set(0, 0, farZ - pivotZ);
  }

  // Vantail dégénéré (grand axe nul) : direction arbitraire plutôt qu'un
  // vecteur nul, pour que `normalize()` en aval ne produise jamais NaN.
  if (farLocalDir.lengthSq() < 1e-10) farLocalDir.set(1, 0, 0);
  else farLocalDir.normalize();

  return { pivotLocal, farLocalDir, grandAxisLocalLength, axis };
}

export function resolveAutoOpenSign(
  pivotWorld: THREE.Vector3,
  farDirWorld: THREE.Vector3,
  openerPosition: THREE.Vector3,
): 1 | -1 {
  const normal = new THREE.Vector3().crossVectors(farDirWorld, new THREE.Vector3(0, 1, 0));
  if (normal.lengthSq() < 1e-10) return 1; // vantail dégénéré : repli arbitraire.
  normal.normalize();
  const offsetX = openerPosition.x - pivotWorld.x;
  const offsetZ = openerPosition.z - pivotWorld.z;
  const side = offsetX * normal.x + offsetZ * normal.z;
  return side >= 0 ? 1 : -1;
}

/** Pivot d'un battant, en espace ROOT (mesh fermé) — TRS local -> root. */
export function hingePivotInRootSpace(
  closedPosition: THREE.Vector3,
  closedQuaternion: THREE.Quaternion,
  pivotLocal: THREE.Vector3,
  scale: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 {
  out.set(pivotLocal.x * scale.x, pivotLocal.y * scale.y, pivotLocal.z * scale.z);
  out.applyQuaternion(closedQuaternion);
  out.add(closedPosition);
  return out;
}

export function composeBattantPose(
  closedPosition: THREE.Vector3,
  closedQuaternion: THREE.Quaternion,
  pivotWorld: THREE.Vector3,
  theta: number,
  outPosition: THREE.Vector3,
  outQuaternion: THREE.Quaternion,
): void {
  const deltaQuat = new THREE.Quaternion().setFromAxisAngle(UP_AXIS, theta);
  outPosition.copy(closedPosition).sub(pivotWorld).applyQuaternion(deltaQuat).add(pivotWorld);
  outQuaternion.copy(closedQuaternion).premultiply(deltaQuat);
}

const UP_AXIS = new THREE.Vector3(0, 1, 0);

/** Pose d'un coulissant : translation de `distance` mètres le long du grand axe LOCAL, signée par `sign`. */
export function composeCoulissePose(
  closedPosition: THREE.Vector3,
  closedQuaternion: THREE.Quaternion,
  axis: "x" | "z",
  sign: 1 | -1,
  distance: number,
  outPosition: THREE.Vector3,
): void {
  const localAxis = axis === "x" ? AXIS_X : AXIS_Z;
  const worldAxis = localAxis.clone().applyQuaternion(closedQuaternion);
  outPosition.copy(closedPosition).addScaledVector(worldAxis, sign * distance);
}

const AXIS_X = new THREE.Vector3(1, 0, 0);

const AXIS_Z = new THREE.Vector3(0, 0, 1);

/** Pose d'un rideau/panneau vertical : translation pure sur Y. `monte` = signe +1, `descend` = signe −1. */
export function composeVerticalPose(
  closedPosition: THREE.Vector3,
  sign: 1 | -1,
  distance: number,
  outPosition: THREE.Vector3,
): void {
  outPosition.copy(closedPosition);
  outPosition.y += sign * distance;
}

export function isActorBlockingClosedDoor(
  closedWorldPosition: THREE.Vector3,
  closedWorldQuaternion: THREE.Quaternion,
  halfExtents: THREE.Vector3,
  actor: DoorActor,
): boolean {
  const inverse = closedWorldQuaternion.clone().invert();
  const local = actor.position.clone().sub(closedWorldPosition).applyQuaternion(inverse);
  return (
    Math.abs(local.x) < halfExtents.x + actor.radius &&
    Math.abs(local.y) < halfExtents.y + actor.halfHeight &&
    Math.abs(local.z) < halfExtents.z + actor.radius
  );
}

/** Un occupant (joueur ou ennemi) est-il à portée `auto` du centre d'un groupe ? Horizontal + tolérance d'altitude fixe. */
export function isActorInAutoRange(center: THREE.Vector3, actor: DoorActor, portee: number): boolean {
  const dx = actor.position.x - center.x;
  const dz = actor.position.z - center.z;
  const horizontal = Math.hypot(dx, dz);
  return horizontal <= portee && Math.abs(actor.position.y - center.y) < AUTO_ALTITUDE_TOLERANCE;
}

/** Avance `progress` (0..1) vers `target` de `dt/duree`, clampé. Fonction pure, testée directement. */
export function advanceDoorProgress(progress: number, target: 0 | 1, dt: number, duree: number): number {
  const step = duree > 0 ? dt / duree : 1;
  if (target === 1) return Math.min(1, progress + step);
  return Math.max(0, progress - step);
}

export function resolveMemberOpenSign(member: DoorMember, openerPosition: THREE.Vector3): 1 | -1 {
  if (member.info.movement !== "battant") {
    return member.config.sens === "-" ? -1 : 1; // coulisse : "+"/"-" statique, "auto" invalide ici -> repli "+"
  }
  if (member.config.sens === "+") return 1;
  if (member.config.sens === "-") return -1;
  const pivotWorld = hingePivotInRootSpace(
    member.info.closedPosition,
    member.info.closedQuaternion,
    member.hinge!.pivotLocal,
    member.info.scale,
    new THREE.Vector3(),
  );
  const farDirWorld = member.hinge!.farLocalDir.clone().applyQuaternion(member.info.closedQuaternion);
  return resolveAutoOpenSign(pivotWorld, farDirWorld, openerPosition);
}

export function buildDoorMember(info: DoorInfo, config: ParsedDoorConfig): DoorMember {
  const hinge =
    info.movement === "battant" ? computeHingeGeometry(info.localMin, info.localMax, config.charniere) : null;
  const axis: "x" | "z" | null =
    info.movement === "coulisse"
      ? info.localMax.x - info.localMin.x >= info.localMax.z - info.localMin.z
        ? "x"
        : "z"
      : null;

  let courseWorld: number;
  if (config.course !== null) {
    courseWorld = config.course;
  } else if (info.movement === "coulisse") {
    const localLength = axis === "x" ? info.localMax.x - info.localMin.x : info.localMax.z - info.localMin.z;
    const scaleComponent = axis === "x" ? info.scale.x : info.scale.z;
    courseWorld = localLength * Math.abs(scaleComponent);
  } else if (info.movement === "monte" || info.movement === "descend") {
    courseWorld = info.halfExtents.y * 2;
  } else {
    courseWorld = hinge ? hinge.grandAxisLocalLength * Math.abs(hinge.axis === "x" ? info.scale.x : info.scale.z) : 0;
  }

  return {
    info,
    config,
    hinge,
    axis,
    courseWorld,
    openSign: 1,
    prevPosition: info.closedPosition.clone(),
    prevQuaternion: info.closedQuaternion.clone(),
    currPosition: info.closedPosition.clone(),
    currQuaternion: info.closedQuaternion.clone(),
    settled: false,
  };
}
