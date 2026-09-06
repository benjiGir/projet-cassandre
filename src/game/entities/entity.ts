import * as THREE from "three";

/**
 * Contrat minimal partagé par toute entité de jeu (invariant #8, pas d'ECS
 * avant 12 types). Volontairement squelettique, à garder ainsi.
 * see: docs/systems/entites.md#le-contrat-minimal-partagé-par-toute-entité-entity
 */
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
