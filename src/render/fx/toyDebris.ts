import * as THREE from "three";
import { WATER_GEOMETRY, WATER_MATERIAL } from "./waterResources";

// Même gravité visuelle, sans dépendance à Rapier.
const TOY_GRAVITY = -25;

const PARTICLE_LIFETIME = 0.4; // s
const PARTICLES_PER_HIT_MELEE = 4;
const PARTICLES_PER_HIT_SHOTGUN = 5;
const PARTICLE_SIZE = 0.03; // m
const PARTICLE_SPEED_MIN = 2; // m/s
const PARTICLE_SPEED_MAX = 5; // m/s
// Dispersion cosmétique issue du flux de présentation seedé.
const PARTICLE_SPREAD = 0.6;

const SHELL_LIFETIME = 1.6; // s
const SHELL_EJECT_SPEED = 1.8; // m/s, latéral
const SHELL_EJECT_UP_SPEED = 2.2; // m/s, vertical
const SHELL_RESTITUTION = 0.3;
const SHELL_FRICTION = 0.6;
// Plan de rebond approximé à y=0 ; une douille peut traverser marches et étages.
const SHELL_GROUND_Y = 0;


const GIB_LIFETIME = 0.9; // s, plus long que PARTICLE_LIFETIME (chunks plus gros, chute plus lisible)
const GIBS_PER_KILL = 8;
const GIB_SIZE = 0.08; // m, cube de base — voir le scale non uniforme dans spawnGibs pour casser la silhouette
const GIB_SPEED_MIN = 3; // m/s
const GIB_SPEED_MAX = 7; // m/s

const GIB_SPREAD = 0.9;
const GIB_COLOR = 0x3a120f; // rouge/brun sombre, nettement plus sombre que PARTICLE_MATERIAL

const GIB_GEOMETRY = new THREE.BoxGeometry(GIB_SIZE, GIB_SIZE, GIB_SIZE);
const GIB_MATERIAL = new THREE.MeshLambertMaterial({ color: GIB_COLOR });

const DEBRIS_LIFETIME = 1.4; // s
const DEBRIS_SIZE = 0.06; // m
const DEBRIS_SPEED_MIN = 2;
const DEBRIS_SPEED_MAX = 5.5;
const DEBRIS_SPREAD = 1.1;
const DEBRIS_GEOMETRY = new THREE.BoxGeometry(DEBRIS_SIZE, DEBRIS_SIZE, DEBRIS_SIZE);

const FROST_LIFETIME = 1.8; // s, plus long que les débris — une bouffée qui retombe lentement doit avoir le temps de le faire
const FROST_COUNT = 14;
const FROST_SIZE = 0.05;
const FROST_SPEED_MIN = 0.6;
const FROST_SPEED_MAX = 1.8;
const FROST_SPREAD = 1.3; // bouffée large, pas un jet dirigé
const FROST_GRAVITY_SCALE = 0.12;
const FROST_COLOR = 0xdcf2fb; // blanc légèrement bleuté
const FROST_GEOMETRY = new THREE.BoxGeometry(FROST_SIZE, FROST_SIZE, FROST_SIZE);
const FROST_MATERIAL = new THREE.MeshLambertMaterial({ color: FROST_COLOR });

// Explosion : des éclats incandescents qui fusent en tous sens — la boule de
// feu et sa fumée sont dans `explosions.ts`.
const EMBER_LIFETIME = 1.1; // s
const EMBER_COUNT = 22;
const EMBER_SIZE = 0.09; // m
const EMBER_SPEED_MIN = 5; // m/s
const EMBER_SPEED_MAX = 13; // m/s
const EMBER_SPREAD = 2.2; // presque une sphère : un souffle n'a pas de direction
const EMBER_GEOMETRY = new THREE.BoxGeometry(EMBER_SIZE, EMBER_SIZE, EMBER_SIZE);
// Lambert émissif, pas Basic : le programme des autres débris, déjà compilé.
const EMBER_MATERIAL = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: 0xf2891d });

// see: docs/6-reference/notes-code-rendu.md#fontaines-permanentes

const CERAMIC_LIFETIME = 1.1; // s
const CERAMIC_COUNT = 7;
const CERAMIC_SIZE = 0.07; // m
const CERAMIC_SPEED_MIN = 2; // m/s
const CERAMIC_SPEED_MAX = 5; // m/s
const CERAMIC_SPREAD = 1.0;
const CERAMIC_COLOR = 0xe8e4da; // faïence blanc cassé
const CERAMIC_GEOMETRY = new THREE.BoxGeometry(CERAMIC_SIZE, CERAMIC_SIZE, CERAMIC_SIZE);
const CERAMIC_MATERIAL = new THREE.MeshLambertMaterial({ color: CERAMIC_COLOR });

const WATER_BURST_LIFETIME = 0.7; // s — la fontaine PERMANENTE prend le relais tout de suite après, cette gerbe n'a pas besoin de durer
const WATER_BURST_COUNT = 10;
const WATER_BURST_SPEED_MIN = 2.5; // m/s
const WATER_BURST_SPEED_MAX = 5; // m/s
const WATER_BURST_SPREAD = 0.5;

interface ToyParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  // Rebond au sol (douilles) ou disparition directe (particules d'impact).
  bounce: boolean;

  gravityScale: number;
}


const PARTICLE_GEOMETRY = new THREE.BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);

const PARTICLE_MATERIAL = new THREE.MeshLambertMaterial({ color: 0x2c2620 });
const BLOOD_COLOR = 0x5a1418;
const BLOOD_MATERIAL = new THREE.MeshLambertMaterial({ color: BLOOD_COLOR });
const FLESH_SURFACE = "flesh";
const SHELL_GEOMETRY = new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6);
const SHELL_MATERIAL = new THREE.MeshLambertMaterial({ color: 0xc98a2c }); // laiton


const UP_DIRECTION = new THREE.Vector3(0, 1, 0);

export class ToyDebris {
  private readonly particles: ToyParticle[] = [];
  private readonly casings: ToyParticle[] = [];
  private readonly gibs: ToyParticle[] = [];
  private readonly debris: ToyParticle[] = [];
  private readonly frost: ToyParticle[] = [];
  private readonly ceramic: ToyParticle[] = [];
  private readonly waterBurst: ToyParticle[] = [];
  private readonly embers: ToyParticle[] = [];

  // Réutiliser le matériau par couleur pour éviter une allocation GPU à chaque casse.
  private readonly debrisMaterials = new Map<number, THREE.MeshLambertMaterial>();


  constructor(private readonly scene: THREE.Scene, private readonly random: () => number) {}

  private clearToyParticles(list: ToyParticle[]): void {
    for (const particle of list) this.scene.remove(particle.mesh);
    list.length = 0;
  }

  spawnImpactParticles(point: THREE.Vector3, normal: THREE.Vector3, weapon: "melee" | "pistol" | "shotgun", material: string) {
    const count = weapon === "shotgun" ? PARTICLES_PER_HIT_SHOTGUN : PARTICLES_PER_HIT_MELEE;
    const particleMaterial = material === FLESH_SURFACE ? BLOOD_MATERIAL : PARTICLE_MATERIAL;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(PARTICLE_GEOMETRY, particleMaterial);
      mesh.position.copy(point);
      this.scene.add(mesh);

      const vx = normal.x + (this.random() * 2 - 1) * PARTICLE_SPREAD;
      const vy = normal.y + (this.random() * 2 - 1) * PARTICLE_SPREAD + 0.5;
      const vz = normal.z + (this.random() * 2 - 1) * PARTICLE_SPREAD;
      const speed = PARTICLE_SPEED_MIN + this.random() * (PARTICLE_SPEED_MAX - PARTICLE_SPEED_MIN);
      const velocity = new THREE.Vector3(vx, vy, vz).normalize().multiplyScalar(speed);

      this.particles.push({ mesh, velocity, life: PARTICLE_LIFETIME, bounce: false, gravityScale: 1 });
    }
  }

  spawnShellCasing(muzzlePosition: THREE.Vector3, muzzleDirection: THREE.Vector3) {
    const mesh = new THREE.Mesh(SHELL_GEOMETRY, SHELL_MATERIAL);
    mesh.position.copy(muzzlePosition);
    this.scene.add(mesh);

    // Une visée verticale dégénérée se rabat sur +X pour l’éjection latérale.
    let rightX = -muzzleDirection.z;
    let rightZ = muzzleDirection.x;
    const rightLen = Math.hypot(rightX, rightZ);
    if (rightLen < 1e-4) {
      rightX = 1;
      rightZ = 0;
    } else {
      rightX /= rightLen;
      rightZ /= rightLen;
    }

    const velocity = new THREE.Vector3(rightX * SHELL_EJECT_SPEED, SHELL_EJECT_UP_SPEED, rightZ * SHELL_EJECT_SPEED);
    this.casings.push({ mesh, velocity, life: SHELL_LIFETIME, bounce: true, gravityScale: 1 });
  }

  spawnGibs(point: THREE.Vector3, direction: THREE.Vector3) {
    this.spawnChunks(this.gibs, point, direction, GIB_GEOMETRY, GIB_MATERIAL, {
      count: GIBS_PER_KILL,
      lifetime: GIB_LIFETIME,
      spread: GIB_SPREAD,
      speedMin: GIB_SPEED_MIN,
      speedMax: GIB_SPEED_MAX,
      gravityScale: 1,
    });
  }

  spawnDebris(point: THREE.Vector3, direction: THREE.Vector3, color: number, count: number) {
    let material = this.debrisMaterials.get(color);
    if (!material) {
      material = new THREE.MeshLambertMaterial({ color });
      this.debrisMaterials.set(color, material);
    }
    this.spawnChunks(this.debris, point, direction, DEBRIS_GEOMETRY, material, {
      count,
      lifetime: DEBRIS_LIFETIME,
      spread: DEBRIS_SPREAD,
      speedMin: DEBRIS_SPEED_MIN,
      speedMax: DEBRIS_SPEED_MAX,
      gravityScale: 1,
    });
  }

  spawnExplosionBurst(point: THREE.Vector3) {
    this.spawnChunks(this.embers, point, UP_DIRECTION, EMBER_GEOMETRY, EMBER_MATERIAL, {
      count: EMBER_COUNT,
      lifetime: EMBER_LIFETIME,
      spread: EMBER_SPREAD,
      speedMin: EMBER_SPEED_MIN,
      speedMax: EMBER_SPEED_MAX,
      gravityScale: 1,
    });
  }

  spawnFrostBurst(point: THREE.Vector3) {
    this.spawnChunks(this.frost, point, UP_DIRECTION, FROST_GEOMETRY, FROST_MATERIAL, {
      count: FROST_COUNT,
      lifetime: FROST_LIFETIME,
      spread: FROST_SPREAD,
      speedMin: FROST_SPEED_MIN,
      speedMax: FROST_SPEED_MAX,
      gravityScale: FROST_GRAVITY_SCALE,
    });
  }

  spawnCeramicBurst(point: THREE.Vector3, direction: THREE.Vector3) {
    this.spawnChunks(this.ceramic, point, direction, CERAMIC_GEOMETRY, CERAMIC_MATERIAL, {
      count: CERAMIC_COUNT,
      lifetime: CERAMIC_LIFETIME,
      spread: CERAMIC_SPREAD,
      speedMin: CERAMIC_SPEED_MIN,
      speedMax: CERAMIC_SPEED_MAX,
      gravityScale: 1,
    });
    this.spawnChunks(this.waterBurst, point, UP_DIRECTION, WATER_GEOMETRY, WATER_MATERIAL, {
      count: WATER_BURST_COUNT,
      lifetime: WATER_BURST_LIFETIME,
      spread: WATER_BURST_SPREAD,
      speedMin: WATER_BURST_SPEED_MIN,
      speedMax: WATER_BURST_SPEED_MAX,
      gravityScale: 1,
    });
  }

  private spawnChunks(
    list: ToyParticle[],
    point: THREE.Vector3,
    direction: THREE.Vector3,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    opts: { count: number; lifetime: number; spread: number; speedMin: number; speedMax: number; gravityScale: number },
  ) {
    for (let i = 0; i < opts.count; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(point);
      mesh.scale.set(0.6 + this.random() * 0.8, 0.6 + this.random() * 0.8, 0.6 + this.random() * 0.8);
      this.scene.add(mesh);

      const vx = direction.x + (this.random() * 2 - 1) * opts.spread;
      const vy = direction.y + (this.random() * 2 - 1) * opts.spread + 0.8;
      const vz = direction.z + (this.random() * 2 - 1) * opts.spread;
      const speed = opts.speedMin + this.random() * (opts.speedMax - opts.speedMin);
      const velocity = new THREE.Vector3(vx, vy, vz).normalize().multiplyScalar(speed);

      list.push({ mesh, velocity, life: opts.lifetime, bounce: false, gravityScale: opts.gravityScale });
    }
  }

  private updateToyPhysics(list: ToyParticle[], realDt: number) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]!;
      p.life -= realDt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        list.splice(i, 1);
        continue;
      }

      p.velocity.y += TOY_GRAVITY * p.gravityScale * realDt;
      p.mesh.position.addScaledVector(p.velocity, realDt);

      if (p.bounce && p.mesh.position.y <= SHELL_GROUND_Y && p.velocity.y < 0) {
        p.mesh.position.y = SHELL_GROUND_Y;
        p.velocity.y = -p.velocity.y * SHELL_RESTITUTION;
        p.velocity.x *= SHELL_FRICTION;
        p.velocity.z *= SHELL_FRICTION;
      }

      // Roulis jouet, purement cosmétique — aucune signification physique.
      p.mesh.rotation.x += realDt * 10;
      p.mesh.rotation.z += realDt * 7;
    }
  }
  update(realDt: number): void {
    this.updateToyPhysics(this.particles, realDt);
    this.updateToyPhysics(this.casings, realDt);
    this.updateToyPhysics(this.gibs, realDt);
    this.updateToyPhysics(this.debris, realDt);
    this.updateToyPhysics(this.frost, realDt);
    this.updateToyPhysics(this.ceramic, realDt);
    this.updateToyPhysics(this.waterBurst, realDt);
    this.updateToyPhysics(this.embers, realDt);
  }

  reset(): void {
    this.clearToyParticles(this.particles);
    this.clearToyParticles(this.casings);
    this.clearToyParticles(this.gibs);
    this.clearToyParticles(this.debris);
    this.clearToyParticles(this.frost);
    this.clearToyParticles(this.ceramic);
    this.clearToyParticles(this.waterBurst);
    this.clearToyParticles(this.embers);
  }
}
