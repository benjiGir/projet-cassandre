import type * as THREE from "three";

import { CameraShake } from "./fx/cameraShake";
import { MuzzleFlashes } from "./fx/muzzleFlashes";
import { ImpactDecals } from "./fx/impactDecals";
import { ToyDebris } from "./fx/toyDebris";
import { WaterJets } from "./fx/waterJets";

// see: docs/6-reference/notes-code-rendu.md#effets-et-allocation
export class FxSystem {
  private random: () => number = () => 0.5;
  private readonly shake: CameraShake;
  private readonly flashes: MuzzleFlashes;
  private readonly decals: ImpactDecals;
  private readonly debris: ToyDebris;
  private readonly water: WaterJets;

  constructor(scene: THREE.Scene) {
    // Une seule lecture du flux cosmétique, partagée dans le même ordre d'appels.
    const nextRandom = () => this.random();
    this.shake = new CameraShake(nextRandom);
    this.flashes = new MuzzleFlashes(scene);
    this.decals = new ImpactDecals(scene);
    this.debris = new ToyDebris(scene, nextRandom);
    this.water = new WaterJets(scene, nextRandom);
  }

  setRandom(random: () => number): void { this.random = random; }

  resetSession(): void {
    this.shake.reset();
    this.flashes.reset();
    this.decals.reset();
    this.debris.reset();
    this.water.clearWaterJets();
  }

  triggerShake(amplitude: number, duration: number): void { this.shake.triggerShake(amplitude, duration); }
  currentShakeOffset(out: THREE.Vector3): THREE.Vector3 { return this.shake.currentShakeOffset(out); }
  spawnMuzzleFlash(position: THREE.Vector3, direction: THREE.Vector3, weapon: "pistol" | "shotgun"): void {
    this.flashes.spawnMuzzleFlash(position, direction, weapon);
  }
  spawnImpactDecal(point: THREE.Vector3, normal: THREE.Vector3, material: string): void {
    this.decals.spawnImpactDecal(point, normal, material);
  }
  spawnImpactParticles(point: THREE.Vector3, normal: THREE.Vector3, weapon: "melee" | "pistol" | "shotgun", material: string): void {
    this.debris.spawnImpactParticles(point, normal, weapon, material);
  }
  spawnShellCasing(position: THREE.Vector3, direction: THREE.Vector3): void { this.debris.spawnShellCasing(position, direction); }
  spawnGibs(point: THREE.Vector3, direction: THREE.Vector3): void { this.debris.spawnGibs(point, direction); }
  spawnDebris(point: THREE.Vector3, direction: THREE.Vector3, color: number, count: number): void {
    this.debris.spawnDebris(point, direction, color, count);
  }
  spawnFrostBurst(point: THREE.Vector3): void { this.debris.spawnFrostBurst(point); }
  spawnCeramicBurst(point: THREE.Vector3, direction: THREE.Vector3): void { this.debris.spawnCeramicBurst(point, direction); }
  addWaterJet(origin: THREE.Vector3): void { this.water.addWaterJet(origin); }
  clearWaterJets(): void { this.water.clearWaterJets(); }

  update(realDt: number): void {
    this.shake.update(realDt);
    this.flashes.update();
    this.debris.update(realDt);
    this.water.update(realDt);
  }
}
