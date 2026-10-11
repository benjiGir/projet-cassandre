import type * as THREE from "three";

export interface HeroAsset {
  readonly root: THREE.Group;
  readonly animations: readonly THREE.AnimationClip[];
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
