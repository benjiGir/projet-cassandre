import * as THREE from "three";
import { WATER_GEOMETRY, WATER_MATERIAL, WATER_DROPLET_SIZE } from "./waterResources";

const TOY_GRAVITY = -25;
const WATER_MAX_JETS = 8;
const WATER_DROPLETS_PER_JET = 28; // gouttes en l'air, en vol continu
const WATER_SPLASHES_PER_JET = 6; // éclaboussures au sol, round-robin PAR JET
const WATER_DROPLET_TOTAL = WATER_MAX_JETS * WATER_DROPLETS_PER_JET;
const WATER_SPLASH_TOTAL = WATER_MAX_JETS * WATER_SPLASHES_PER_JET;
// Taille totale du pool d'instances — CONSTANTE, jamais redimensionnée après construction du `InstancedMesh`.
const WATER_INSTANCE_COUNT = WATER_DROPLET_TOTAL + WATER_SPLASH_TOTAL;

const WATER_JET_HEIGHT_MIN = 1.0; // m
const WATER_JET_HEIGHT_MAX = 1.5; // m

const WATER_FAN_SPEED_MIN = 0.1; // m/s
const WATER_FAN_SPEED_MAX = 0.5; // m/s

const WATER_DROPLET_STRETCH = new THREE.Vector3(0.8, 1.8, 0.8);

const WATER_SPLASH_LIFETIME = 0.18; // s — rythme vif, plusieurs éclaboussures par seconde et par jet
const WATER_SPLASH_SIZE = 0.09; // m, rayon max de la marque au sol
const WATER_SPLASH_FLATNESS = 0.015; // m, hauteur écrasée : une flaque, pas un cube
const WATER_SPLASH_JITTER = 0.12; // m, décalage horizontal aléatoire autour du pied du jet
const WATER_SPLASH_GROW_FRACTION = 0.3;

const WATER_BOUNDS_MARGIN = 0.8; // m

interface WaterDropletState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

interface WaterSplashState {
  position: THREE.Vector3;

  life: number;
}

interface WaterJetSlot {
  active: boolean;
  origin: THREE.Vector3;

  splashCursor: number;
}

// Rotation identité des gouttes/éclaboussures d'eau — jamais tournées, « carrés francs » axés sur les axes du monde. Réutilisée en lecture seule, jamais mutée.
const IDENTITY_QUATERNION = new THREE.Quaternion();

// Matrice à échelle nulle : cache une instance d'`InstancedMesh` sans la retirer du pool (voir `WATER_INSTANCE_COUNT`). Réutilisée en lecture seule, jamais mutée.
const ZERO_SCALE_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

export class WaterJets {
  private readonly waterJetMesh: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>;
  private readonly waterJets: WaterJetSlot[] = [];
  private readonly waterDroplets: WaterDropletState[] = [];
  private readonly waterSplashes: WaterSplashState[] = [];
  private waterJetCursor = 0;

  private readonly scratchDir = new THREE.Vector3();
  private readonly scratchBox = new THREE.Box3();
  private readonly scratchScale = new THREE.Vector3();
  private readonly scratchMatrix = new THREE.Matrix4();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly random: () => number,
  ) {
    this.waterJetMesh = new THREE.InstancedMesh(WATER_GEOMETRY, WATER_MATERIAL, WATER_INSTANCE_COUNT);
    // Tenir la sphère des jets à jour : celle calculée initialement serait à l’origine.
    this.waterJetMesh.boundingSphere = new THREE.Sphere();
    this.waterJetMesh.visible = false;
    this.scene.add(this.waterJetMesh);

    for (let j = 0; j < WATER_MAX_JETS; j++) {
      this.waterJets.push({ active: false, origin: new THREE.Vector3(), splashCursor: 0 });
    }
    for (let i = 0; i < WATER_DROPLET_TOTAL; i++) {
      this.waterDroplets.push({ position: new THREE.Vector3(), velocity: new THREE.Vector3() });
    }
    for (let i = 0; i < WATER_SPLASH_TOTAL; i++) {
      this.waterSplashes.push({ position: new THREE.Vector3(), life: 0 });
    }
    for (let i = 0; i < WATER_INSTANCE_COUNT; i++) {
      this.waterJetMesh.setMatrixAt(i, ZERO_SCALE_MATRIX);
    }
    this.waterJetMesh.instanceMatrix.needsUpdate = true;
  }

  addWaterJet(origin: THREE.Vector3) {
    const jetIndex = this.waterJetCursor;
    this.waterJetCursor = (this.waterJetCursor + 1) % WATER_MAX_JETS;

    const slot = this.waterJets[jetIndex];
    slot.active = true;
    slot.origin.copy(origin);
    slot.splashCursor = 0;
    this.updateWaterBounds();

    for (let d = 0; d < WATER_DROPLETS_PER_JET; d++) {
      const droplet = this.waterDroplets[jetIndex * WATER_DROPLETS_PER_JET + d];
      this.resetWaterDroplet(droplet, slot.origin);
      // Déphaser les gouttes évite une bouffée synchrone à l’allumage.
      const flight = this.random() * ((2 * droplet.velocity.y) / -TOY_GRAVITY);
      droplet.position.addScaledVector(droplet.velocity, flight);
      droplet.position.y += 0.5 * TOY_GRAVITY * flight * flight;
      droplet.velocity.y += TOY_GRAVITY * flight;
    }
    for (let s = 0; s < WATER_SPLASHES_PER_JET; s++) {
      this.waterSplashes[jetIndex * WATER_SPLASHES_PER_JET + s].life = 0;
      this.waterJetMesh.setMatrixAt(WATER_DROPLET_TOTAL + jetIndex * WATER_SPLASHES_PER_JET + s, ZERO_SCALE_MATRIX);
    }
    this.waterJetMesh.instanceMatrix.needsUpdate = true;
  }

  clearWaterJets() {
    for (const slot of this.waterJets) slot.active = false;
    for (const splash of this.waterSplashes) splash.life = 0;
    for (let i = 0; i < WATER_INSTANCE_COUNT; i++) {
      this.waterJetMesh.setMatrixAt(i, ZERO_SCALE_MATRIX);
    }
    this.waterJetMesh.instanceMatrix.needsUpdate = true;
    this.waterJetCursor = 0;
    this.updateWaterBounds();
  }

  private updateWaterBounds() {
    const box = this.scratchBox.makeEmpty();
    for (const slot of this.waterJets) {
      if (!slot.active) continue;
      box.expandByPoint(slot.origin);

      this.scratchDir.set(slot.origin.x, slot.origin.y + WATER_JET_HEIGHT_MAX, slot.origin.z);
      box.expandByPoint(this.scratchDir);
    }
    this.waterJetMesh.visible = !box.isEmpty();
    if (box.isEmpty()) return;
    box.expandByScalar(WATER_BOUNDS_MARGIN);
    box.getBoundingSphere(this.waterJetMesh.boundingSphere!);
  }

  private resetWaterDroplet(droplet: WaterDropletState, origin: THREE.Vector3) {
    droplet.position.copy(origin);
    const height = WATER_JET_HEIGHT_MIN + this.random() * (WATER_JET_HEIGHT_MAX - WATER_JET_HEIGHT_MIN);
    const upSpeed = Math.sqrt(2 * -TOY_GRAVITY * height);
    const fanAngle = this.random() * Math.PI * 2;
    const fanSpeed = WATER_FAN_SPEED_MIN + this.random() * (WATER_FAN_SPEED_MAX - WATER_FAN_SPEED_MIN);
    droplet.velocity.set(Math.cos(fanAngle) * fanSpeed, upSpeed, Math.sin(fanAngle) * fanSpeed);
  }

  private triggerWaterSplash(jetIndex: number) {
    const slot = this.waterJets[jetIndex];
    const local = slot.splashCursor;
    slot.splashCursor = (slot.splashCursor + 1) % WATER_SPLASHES_PER_JET;

    const splash = this.waterSplashes[jetIndex * WATER_SPLASHES_PER_JET + local];
    splash.position.copy(slot.origin);
    splash.position.x += (this.random() * 2 - 1) * WATER_SPLASH_JITTER;
    splash.position.z += (this.random() * 2 - 1) * WATER_SPLASH_JITTER;
    splash.life = WATER_SPLASH_LIFETIME;
  }

  private updateWaterJets(realDt: number) {
    let matricesDirty = false;

    for (let j = 0; j < WATER_MAX_JETS; j++) {
      const slot = this.waterJets[j];
      if (!slot.active) continue;
      matricesDirty = true;

      for (let d = 0; d < WATER_DROPLETS_PER_JET; d++) {
        const idx = j * WATER_DROPLETS_PER_JET + d;
        const droplet = this.waterDroplets[idx];

        droplet.velocity.y += TOY_GRAVITY * realDt;
        droplet.position.addScaledVector(droplet.velocity, realDt);

        if (droplet.position.y <= slot.origin.y && droplet.velocity.y < 0) {
          this.triggerWaterSplash(j);
          this.resetWaterDroplet(droplet, slot.origin);
        }

        // La géométrie mesure déjà 0,05 m : appliquer des facteurs, pas des mètres.
        this.scratchScale.copy(WATER_DROPLET_STRETCH);
        this.scratchMatrix.compose(droplet.position, IDENTITY_QUATERNION, this.scratchScale);
        this.waterJetMesh.setMatrixAt(idx, this.scratchMatrix);
      }

      for (let s = 0; s < WATER_SPLASHES_PER_JET; s++) {
        const local = j * WATER_SPLASHES_PER_JET + s;
        const splash = this.waterSplashes[local];
        if (splash.life <= 0) continue; // déjà éteinte, matrice déjà à échelle nulle

        splash.life -= realDt;
        const instanceIdx = WATER_DROPLET_TOTAL + local;
        if (splash.life <= 0) {
          this.waterJetMesh.setMatrixAt(instanceIdx, ZERO_SCALE_MATRIX);
          continue;
        }

        // Disparaître par l’échelle évite le tri de transparence entre instances.
        const t = 1 - splash.life / WATER_SPLASH_LIFETIME;
        const scaleFactor =
          t < WATER_SPLASH_GROW_FRACTION
            ? t / WATER_SPLASH_GROW_FRACTION
            : 1 - (t - WATER_SPLASH_GROW_FRACTION) / (1 - WATER_SPLASH_GROW_FRACTION);

        const radial = (WATER_SPLASH_SIZE * scaleFactor) / WATER_DROPLET_SIZE;
        this.scratchScale.set(radial, WATER_SPLASH_FLATNESS / WATER_DROPLET_SIZE, radial);
        this.scratchMatrix.compose(splash.position, IDENTITY_QUATERNION, this.scratchScale);
        this.waterJetMesh.setMatrixAt(instanceIdx, this.scratchMatrix);
      }
    }

    if (matricesDirty) this.waterJetMesh.instanceMatrix.needsUpdate = true;
  }
  update(realDt: number): void {
    this.updateWaterJets(realDt);
  }
}
