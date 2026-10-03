import type * as THREE from "three";
import type { WeaponKind } from "../game/player/weaponTypes";

export type PickupWeaponKind = Exclude<WeaponKind, "none">;

export type FoodPart = {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshLambertMaterial;
  position: THREE.Vector3;
  rotation: THREE.Euler;
};

export interface PickupModel {
  geometry: THREE.BoxGeometry;
  material: THREE.MeshLambertMaterial;
}
