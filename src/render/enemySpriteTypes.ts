import type * as THREE from "three";

export type SpriteAnimationName = "idle" | "alert" | "chase" | "aim" | "fire" | "stagger" | "death";

export interface SpriteAnimation {
  row: number;
  frames: number;
  fps?: number;
  metersPerCycle?: number;
  // Durée d'affichage après l'évènement (`fire`).
  duration?: number;
}

export interface EnemySpriteSheet {
  cellWidth: number;
  cellHeight: number;
  rows: number;
  pixelsPerMeter: number;
  feetFromBottom: number;
  animations: Record<SpriteAnimationName, SpriteAnimation>;
  atlases: { humain: THREE.Texture } & Record<string, THREE.Texture | undefined>;
}

// see: docs/6-reference/notes-code-rendu.md#planches-et-chargement-ennemi
export interface EnemyAnimationInput {
  pose: "idle" | "alert" | "chase" | "aim" | "stagger" | "death" | "corpse";
  poseTime: number;
  // Durée prévue de la pose (`alert`, `stagger`, `death`) sur laquelle étaler ses frames ; 0 sinon.
  poseDuration: number;
  clock: number;
  stride: number;
  timeSinceShot: number;
}
