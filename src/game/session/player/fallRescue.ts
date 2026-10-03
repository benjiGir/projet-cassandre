import * as THREE from "three";

// see: docs/archive/systems-boucle-de-jeu.md#filet-de-chute

// see: docs/6-reference/notes-code-gameplay.md#progression-et-fin
export const RESCUE_FALL_DEPTH = 12;

export function recordSafeGround(
  safeGround: THREE.Vector3,
  position: THREE.Vector3,
  isGrounded: boolean,
  numCollisions: number,
): boolean {
  if (!isGrounded || numCollisions <= 0) return false;
  safeGround.copy(position);
  return true;
}

export function shouldRescue(safeGround: THREE.Vector3, position: THREE.Vector3, isGrounded: boolean): boolean {
  if (isGrounded) return false;
  if (safeGround.lengthSq() === 0) return false;
  return safeGround.y - position.y >= RESCUE_FALL_DEPTH;
}
