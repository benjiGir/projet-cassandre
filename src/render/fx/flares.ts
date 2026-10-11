import * as THREE from "three";

// Fusées du pistolet de détresse en vol : un cœur incandescent, sa lueur rouge
// sur le décor et les étincelles qu'il sème. La simulation est dans
// `WeaponSystem` ; ici, seulement ce qu'on en voit.

/** Fusées dessinées en même temps : la cadence et la durée de vol n'en laissent jamais plus de trois en l'air. */
const POOL_SIZE = 4;
/** Lampes partagées : au-delà, la fusée la plus ancienne garde la sienne. */
const LIGHT_COUNT = 2;
const CORE_RADIUS = 0.09; // m — trois à quatre pixels à dix mètres en 640×360
const LIGHT_COLOR = 0xff4530;
const LIGHT_INTENSITY = 70;
const LIGHT_RANGE = 11;
/** Temps de gameplay pendant lequel la fusée rejoint sa vraie trajectoire en partant du canon affiché. */
const MUZZLE_BLEND = 0.14; // s
/** Distance entre deux étincelles semées, en mètres. */
const SPARK_SPACING = 0.9;

const CORE_GEOMETRY = new THREE.IcosahedronGeometry(CORE_RADIUS, 0);
// Lambert émissif, pas Basic : le programme des débris, déjà compilé.
const CORE_MATERIAL = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: 0xffb09a });

/** Ce que l'affichage lit d'une fusée en vol — la forme de `FlareProjectile`, côté jeu. */
export interface FlareView {
  readonly id: number;
  readonly position: THREE.Vector3;
  readonly previousPosition: THREE.Vector3;
  /** Secondes de gameplay depuis le tir. */
  readonly age: number;
}

interface FlareSlot {
  core: THREE.Mesh;
  light: THREE.PointLight | null;
  /** Fusée suivie, `-1` si le slot est libre. */
  id: number;
  /** Écart entre le canon affiché et l'origine réelle du tir, résorbé pendant `MUZZLE_BLEND`. */
  muzzleOffset: THREE.Vector3;
  lastSpark: THREE.Vector3;
  seen: boolean;
}

export class Flares {
  private readonly slots: FlareSlot[] = [];
  private readonly lights: THREE.PointLight[] = [];
  private readonly truePosition = new THREE.Vector3();
  private readonly travel = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    private readonly spawnSpark: (point: THREE.Vector3, direction: THREE.Vector3) => void,
  ) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const core = new THREE.Mesh(CORE_GEOMETRY, CORE_MATERIAL);
      core.visible = false;
      scene.add(core);
      this.slots.push({
        core,
        light: null,
        id: -1,
        muzzleOffset: new THREE.Vector3(),
        lastSpark: new THREE.Vector3(),
        seen: false,
      });
    }
    // Lampes toujours présentes, éteintes par leur intensité : en ajouter une
    // en plein combat recompilerait tous les matériaux éclairés.
    for (let i = 0; i < LIGHT_COUNT; i++) {
      const light = new THREE.PointLight(LIGHT_COLOR, 0, LIGHT_RANGE, 2);
      scene.add(light);
      this.lights.push(light);
    }
  }

  /**
   * Pose chaque fusée en vol entre ses deux dernières positions du pas fixe.
   * `muzzle` est le bout du canon tel qu'affiché : une fusée vue pour la
   * première fois en part, puis rejoint la trajectoire réelle, tirée des yeux.
   */
  pose(flares: ReadonlyArray<FlareView>, alpha: number, muzzle: THREE.Vector3): void {
    for (const slot of this.slots) slot.seen = false;

    for (const flare of flares) {
      this.truePosition.lerpVectors(flare.previousPosition, flare.position, alpha);
      let slot = this.slots.find((s) => s.id === flare.id);
      if (!slot) {
        slot = this.slots.find((s) => s.id < 0);
        if (!slot) continue;
        slot.id = flare.id;
        slot.muzzleOffset.subVectors(muzzle, this.truePosition);
        slot.lastSpark.copy(muzzle);
        slot.light = this.lights.find((light) => !this.slots.some((s) => s.light === light)) ?? null;
        slot.core.visible = true;
      }
      slot.seen = true;
      const blend = Math.max(0, 1 - flare.age / MUZZLE_BLEND);
      slot.core.position.copy(this.truePosition).addScaledVector(slot.muzzleOffset, blend);
      if (slot.light) {
        slot.light.position.copy(slot.core.position);
        slot.light.intensity = LIGHT_INTENSITY;
      }
      this.travel.subVectors(slot.core.position, slot.lastSpark);
      if (this.travel.lengthSq() >= SPARK_SPACING * SPARK_SPACING) {
        this.spawnSpark(slot.core.position, this.travel.normalize().negate());
        slot.lastSpark.copy(slot.core.position);
      }
    }

    for (const slot of this.slots) if (!slot.seen && slot.id >= 0) this.release(slot);
  }

  reset(): void {
    for (const slot of this.slots) this.release(slot);
  }

  private release(slot: FlareSlot): void {
    slot.id = -1;
    slot.core.visible = false;
    if (slot.light) slot.light.intensity = 0;
    slot.light = null;
  }
}
