import type * as THREE from "three";
import type { ViewmodelClocks, WeaponKind } from "../game/player/weaponTypes";

export interface ViewmodelSource {
  viewmodelPose(alpha: number, outPosition: THREE.Vector3, outEuler: THREE.Euler): void;
  viewmodelClocks(alpha: number, out: ViewmodelClocks): ViewmodelClocks;
}

export interface WeaponModels {
  crowbar: THREE.BufferGeometry;
  pistol: THREE.BufferGeometry;
  shotgun: THREE.BufferGeometry;
  shotgunPump: THREE.BufferGeometry;
  worldCrowbar: THREE.BufferGeometry;
  worldPistol: THREE.BufferGeometry;
  worldShotgun: THREE.BufferGeometry;
  crowbarPivot: THREE.Vector3;
  pistolPivot: THREE.Vector3;
  shotgunPivot: THREE.Vector3;
  pistolMuzzle: THREE.Vector3;
  shotgunMuzzle: THREE.Vector3;
  pumpAxis: THREE.Vector3;
  // Un seul matériau pour tout : couleurs portées par les sommets.
  material: THREE.MeshLambertMaterial;
}

export interface ViewmodelAnimation {
  weapon: WeaponKind;
  // 0 = en place, 1 = hors écran.
  lowered: number;
  // 0 = repos, 1 = fin du balayage.
  swing: number;
  // 0 = fût en avant, 1 = fût tiré en arrière.
  pump: number;
}
