import type * as THREE from "three";

export type PropDebrisMaterial = "cardboard" | "wood" | "glass" | "metal" | "electronics" | "gas" | "flour" | "water";
export type FragmentMaterial = PropDebrisMaterial | "circuit";

export interface PropFragmentSource {
  center: THREE.Vector3;
  halfExtents: THREE.Vector3;
  rotation: THREE.Quaternion;
  color: THREE.Color;
  direction: THREE.Vector3;
  strength: number;
}

export interface FragmentPose {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  scale: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
}
