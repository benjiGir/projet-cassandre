import * as THREE from "three";

// see: docs/archive/systems-entites.md#le-contrat-minimal-partagé-par-toute-entité-entity
export interface Entity {
  readonly id: number;
  /** Position au pas fixe courant. Voir `previousPosition` pour l'interpolation de rendu (pattern `PlayerController`). */
  readonly position: THREE.Vector3;
  /** Position au pas fixe précédent. */
  readonly previousPosition: THREE.Vector3;
}

let nextEntityId = 1;

/** Identifiant unique, déterministe (compteur monotone) — jamais dérivé de `Math.random()` ou d'une horloge. */
export function allocateEntityId(): number {
  return nextEntityId++;
}
