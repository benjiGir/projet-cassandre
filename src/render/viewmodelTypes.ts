import type * as THREE from "three";

import type { ViewmodelClocks } from "../game/player/weaponTypes";

export interface ViewmodelSource {
  viewmodelPose(alpha: number, outPosition: THREE.Vector3, outEuler: THREE.Euler): void;
  viewmodelClocks(alpha: number, out: ViewmodelClocks): ViewmodelClocks;
}
