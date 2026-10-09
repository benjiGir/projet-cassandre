import type { FiringWeapon } from "../../game/player/weapons/weaponTypes";
import type * as THREE from "three";

import { CameraShake } from "./cameraShake";
import { MuzzleFlashes } from "./muzzleFlashes";
import { ImpactDecals } from "./impactDecals";
import { ToyDebris } from "./toyDebris";
import { WaterJets } from "./waterJets";
import { Explosions } from "./explosions";
import { Gore } from "./gore";
import { EnemyAppearances } from "./enemyAppearances";
import type { BillboardSprite } from "../sprites/billboard";
import type { SurfaceProbe } from "./goreConfig";

// see: docs/6-reference/notes-code-rendu.md#effets-et-allocation
export class FxSystem {
  private random: () => number = () => 0.5;
  private readonly shake: CameraShake;
  private readonly flashes: MuzzleFlashes;
  private readonly decals: ImpactDecals;
  private readonly debris: ToyDebris;
  private readonly water: WaterJets;
  private readonly explosions: Explosions;
  private readonly gore: Gore;
  private readonly appearances: EnemyAppearances;

  constructor(scene: THREE.Scene, enemyAtlases: readonly THREE.Texture[] = []) {
    // Une seule lecture du flux cosmétique, partagée dans le même ordre d'appels.
    const nextRandom = () => this.random();
    this.shake = new CameraShake(nextRandom);
    this.flashes = new MuzzleFlashes(scene);
    this.decals = new ImpactDecals(scene);
    this.debris = new ToyDebris(scene, nextRandom);
    this.water = new WaterJets(scene, nextRandom);
    this.explosions = new Explosions(scene, nextRandom);
    this.gore = new Gore(scene, nextRandom);
    this.appearances = new EnemyAppearances(scene, enemyAtlases);
  }

  setRandom(random: () => number): void {
    this.random = random;
  }

  resetSession(): void {
    this.shake.reset();
    this.flashes.reset();
    this.decals.reset();
    this.debris.reset();
    this.water.clearWaterJets();
    this.explosions.reset();
    this.gore.reset();
    this.appearances.reset();
    // La sonde appartient à la partie qui vient de finir : son monde physique va être libéré.
    this.gore.setSurfaceProbe(null);
  }

  /** Donne au gore de quoi trouver le décor de CETTE partie — voir `SurfaceProbe`. */
  setSurfaceProbe(probe: SurfaceProbe | null): void {
    this.gore.setSurfaceProbe(probe);
  }

  triggerShake(amplitude: number, duration: number): void {
    this.shake.triggerShake(amplitude, duration);
  }
  currentShakeOffset(out: THREE.Vector3): THREE.Vector3 {
    return this.shake.currentShakeOffset(out);
  }
  spawnMuzzleFlash(position: THREE.Vector3, direction: THREE.Vector3, weapon: "pistol" | "shotgun"): void {
    this.flashes.spawnMuzzleFlash(position, direction, weapon);
  }
  followMuzzleFlash(position: THREE.Vector3, direction: THREE.Vector3, weapon: "pistol" | "shotgun"): void {
    this.flashes.followMuzzle(position, direction, weapon);
  }
  advanceMuzzleFlashes(dt: number): void {
    this.flashes.advance(dt);
  }
  spawnImpactDecal(point: THREE.Vector3, normal: THREE.Vector3, material: string): void {
    this.decals.spawnImpactDecal(point, normal, material);
  }
  spawnImpactParticles(point: THREE.Vector3, normal: THREE.Vector3, weapon: FiringWeapon, material: string): void {
    this.debris.spawnImpactParticles(point, normal, weapon, material);
  }
  spawnShellCasing(position: THREE.Vector3, direction: THREE.Vector3): void {
    this.debris.spawnShellCasing(position, direction);
  }
  /** Un ennemi explose : flaque, giclées et morceaux qui retombent — voir `gore.ts`. */
  spawnGibs(point: THREE.Vector3, direction: THREE.Vector3): void {
    this.gore.spawnGibs(point, direction);
  }
  /** Giclée sur le décor derrière un ennemi touché. */
  spawnBloodSpray(point: THREE.Vector3, direction: THREE.Vector3, weapon: FiringWeapon): void {
    this.gore.spawnSpray(point, direction, weapon);
  }
  /** Flaque qui s'étale sous un ennemi mort sur place. */
  spawnBloodPool(center: THREE.Vector3): void {
    this.gore.spawnPool(center);
  }
  /** Taches et morceaux en place, pour les outils et les tests. */
  get goreStats(): { splats: number; restingChunks: number; flyingChunks: number } {
    return {
      splats: this.gore.splatCount,
      restingChunks: this.gore.restingChunkCount,
      flyingChunks: this.gore.flyingChunkCount,
    };
  }
  spawnDebris(point: THREE.Vector3, direction: THREE.Vector3, color: number, count: number): void {
    this.debris.spawnDebris(point, direction, color, count);
  }
  spawnFrostBurst(point: THREE.Vector3): void {
    this.debris.spawnFrostBurst(point);
  }
  spawnCeramicBurst(point: THREE.Vector3, direction: THREE.Vector3): void {
    this.debris.spawnCeramicBurst(point, direction);
  }
  /** Compile le shader de l'explosion sous l'écran de chargement — voir `Explosions.warm`. */
  warmExplosions(camera: THREE.Camera, render: () => void): Promise<void> {
    return this.explosions.warm(camera, render);
  }
  releaseShaderPrograms(): void {
    this.explosions.releaseShaderPrograms();
    this.flashes.releaseShaderPrograms();
    this.appearances.releaseShaderPrograms();
  }
  warmMuzzleFlashes(camera: THREE.Camera, render: () => void): Promise<void> {
    return this.flashes.warm(camera, render);
  }
  spawnEnemyAppearance(sprite: BillboardSprite, feetY: number): void {
    this.appearances.spawn(sprite, feetY);
  }
  followEnemyAppearance(sprite: BillboardSprite, progress: number, alive: boolean): void {
    this.appearances.follow(sprite, progress, alive);
  }
  warmEnemyAppearances(camera: THREE.Camera, render: () => void): Promise<void> {
    return this.appearances.warm(camera, render);
  }
  /** Boule de feu et éclats incandescents d'un prop `gaz` qui saute. */
  spawnExplosion(point: THREE.Vector3): void {
    this.explosions.spawn(point);
    this.debris.spawnExplosionBurst(point);
  }
  addWaterJet(origin: THREE.Vector3): void {
    this.water.addWaterJet(origin);
  }
  clearWaterJets(): void {
    this.water.clearWaterJets();
  }

  update(realDt: number): void {
    this.shake.update(realDt);
    this.debris.update(realDt);
    this.water.update(realDt);
    this.explosions.update(realDt);
    this.gore.update(realDt);
  }
}
