import * as THREE from "three";

/**
 * Contrat minimal partagé par toute entité de jeu (invariant #8 : `Entity[]`
 * + `update(dt)` + `switch`, PAS d'ECS). Volontairement squelettique : un
 * seul type concret existe à ce stade (`Suit`, Phase 3), et rien ici ne doit
 * ressembler à un système de composants génériques — ce serait précisément
 * l'erreur que l'invariant #8 interdit avant 12 types d'ennemis. Ce fichier
 * n'existe que pour donner un id stable et un contrat d'interpolation commun
 * si un second type d'entité apparaît un jour ; il n'est pas un point
 * d'extension à enrichir par anticipation.
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
