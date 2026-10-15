import type * as THREE from "three";

export interface HeroAsset {
  readonly atlases: Readonly<Record<HeroAtlasKind, HeroAtlas>>;
}

export type HeroAtlasKind = "locomotion" | "equipment" | "actions" | "armedWalk";

export interface HeroSpriteFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly anchorX: number;
}

export interface HeroAtlas {
  readonly texture: THREE.Texture;
  readonly width: number;
  readonly height: number;
  readonly frames: readonly (readonly HeroSpriteFrame[])[];
}

export interface HeroMovementSource {
  readonly distanceTravelled: number;
  readonly previousDistanceTravelled: number;
  readonly bobIntensity: number;
  readonly previousBobIntensity: number;
  readonly isGrounded: boolean;
  eyePosition(alpha: number, out: THREE.Vector3): THREE.Vector3;
  runFactorAt(alpha: number): number;
}

export interface HeroPose {
  readonly eyePosition: THREE.Vector3;
  readonly eyeHeight: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly elapsed: number;
  readonly distance: number;
  readonly movement: number;
  readonly running: number;
  readonly grounded: boolean;
}
