import * as THREE from "three";

// see: docs/6-reference/notes-code-rendu.md#effets-et-allocation

const SHAKE_NEGLIGIBLE_FRACTION = 0.05;
const SHAKE_DECAY_RATE = -Math.log(SHAKE_NEGLIGIBLE_FRACTION); // ≈ 2.9957

// Frames d’affichage, pas pas fixes.
const MUZZLE_FLASH_FRAMES = 2;
const MUZZLE_FLASH_POOL_SIZE = 2;

interface MuzzleFlashPreset {
  color: number;

  intensity: number;
  // Portée de la lumière, en mètres.
  range: number;
  // Taille du quad (côté du carré), en mètres.
  size: number;
  // Décalage le long de `muzzleDirection` depuis `muzzlePosition`, en mètres.
  offset: number;
}

// Le pied-de-biche ne doit recevoir aucun flash de canon.
const MUZZLE_FLASH_PRESETS: Record<"pistol" | "shotgun", MuzzleFlashPreset> = {

  pistol: { color: 0xfff0b0, intensity: 28, range: 4, size: 0.12, offset: 0.06 },

  shotgun: { color: 0xfff2c0, intensity: 60, range: 6, size: 0.22, offset: 0.06 },
};

interface MuzzleFlashSlot {
  light: THREE.PointLight;
  quad: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  // Frames d'affichage restantes avant extinction. 0 = éteint.
  framesRemaining: number;
}

// Decals réservés au décor statique : les surfaces mobiles laisseraient des impacts flottants.
const DECAL_POOL_SIZE = 24;
const DECAL_SIZE = 0.12; // m
// Détachement le long de la normale, évite le z-fighting avec la surface touchée.
const DECAL_OFFSET = 0.01; // m

const DECAL_COLOR = 0x1c1a18;

interface DecalSlot {
  mesh: THREE.Mesh;
}


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

// Bleu pâle partagé par la gerbe initiale (`spawnChunks`) ET la fontaine permanente (`InstancedMesh`) — même eau, deux régimes de rendu.
const WATER_COLOR = 0xb7dff0;
const WATER_DROPLET_SIZE = 0.05; // m
const WATER_GEOMETRY = new THREE.BoxGeometry(WATER_DROPLET_SIZE, WATER_DROPLET_SIZE, WATER_DROPLET_SIZE);
const WATER_EMISSIVE = 0x2f5566;
const WATER_MATERIAL = new THREE.MeshLambertMaterial({ color: WATER_COLOR, emissive: WATER_EMISSIVE });

const WATER_BURST_LIFETIME = 0.7; // s — la fontaine PERMANENTE prend le relais tout de suite après, cette gerbe n'a pas besoin de durer
const WATER_BURST_COUNT = 10;
const WATER_BURST_SPEED_MIN = 2.5; // m/s
const WATER_BURST_SPEED_MAX = 5; // m/s
const WATER_BURST_SPREAD = 0.5;

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

interface ToyParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  // Rebond au sol (douilles) ou disparition directe (particules d'impact).
  bounce: boolean;

  gravityScale: number;
}


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

const PARTICLE_GEOMETRY = new THREE.BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);

const PARTICLE_MATERIAL = new THREE.MeshLambertMaterial({ color: 0x2c2620 });
const BLOOD_COLOR = 0x5a1418;
const BLOOD_MATERIAL = new THREE.MeshLambertMaterial({ color: BLOOD_COLOR });
const FLESH_SURFACE = "flesh";
const SHELL_GEOMETRY = new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6);
const SHELL_MATERIAL = new THREE.MeshLambertMaterial({ color: 0xc98a2c }); // laiton

// Normale par défaut d'un `PlaneGeometry` non tourné (+Z). Réutilisée en lecture seule, jamais mutée.
const PLANE_DEFAULT_NORMAL = new THREE.Vector3(0, 0, 1);

const UP_DIRECTION = new THREE.Vector3(0, 1, 0);

// Rotation identité des gouttes/éclaboussures d'eau — jamais tournées, « carrés francs » axés sur les axes du monde. Réutilisée en lecture seule, jamais mutée.
const IDENTITY_QUATERNION = new THREE.Quaternion();

// Matrice à échelle nulle : cache une instance d'`InstancedMesh` sans la retirer du pool (voir `WATER_INSTANCE_COUNT`). Réutilisée en lecture seule, jamais mutée.
const ZERO_SCALE_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

export class FxSystem {
  private random: () => number = () => 0.5;

  // Flux cosmétique indépendant, remplacé à chaque nouvelle partie.
  setRandom(random: () => number): void {
    this.random = random;
  }
  private readonly scene: THREE.Scene;

  private shakePeak = 0;
  private shakeElapsed = 0;
  private shakeDurationActive = 0;

  private readonly muzzleFlashes: MuzzleFlashSlot[] = [];
  private muzzleFlashCursor = 0;
  private readonly decals: DecalSlot[] = [];
  private decalCursor = 0;

  private readonly particles: ToyParticle[] = [];
  private readonly casings: ToyParticle[] = [];
  private readonly gibs: ToyParticle[] = [];
  private readonly debris: ToyParticle[] = [];
  private readonly frost: ToyParticle[] = [];
  private readonly ceramic: ToyParticle[] = [];
  private readonly waterBurst: ToyParticle[] = [];

  private readonly waterJetMesh: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>;
  private readonly waterJets: WaterJetSlot[] = [];
  private readonly waterDroplets: WaterDropletState[] = [];
  private readonly waterSplashes: WaterSplashState[] = [];
  private waterJetCursor = 0;

  // Réutiliser le matériau par couleur pour éviter une allocation GPU à chaque casse.
  private readonly debrisMaterials = new Map<number, THREE.MeshLambertMaterial>();

  private readonly scratchDir = new THREE.Vector3();
  private readonly scratchBox = new THREE.Box3();
  private readonly scratchScale = new THREE.Vector3();
  private readonly scratchMatrix = new THREE.Matrix4();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    for (let i = 0; i < MUZZLE_FLASH_POOL_SIZE; i++) {
      this.muzzleFlashes.push(this.createMuzzleFlashSlot());
    }
    for (let i = 0; i < DECAL_POOL_SIZE; i++) {
      this.decals.push(this.createDecalSlot());
    }

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

  private createMuzzleFlashSlot(): MuzzleFlashSlot {
    const light = new THREE.PointLight(0xfff2c0, 0, 1, 2);
    light.visible = false;
    this.scene.add(light);

    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 1 }),
    );
    quad.visible = false;
    this.scene.add(quad);

    return { light, quad, framesRemaining: 0 };
  }

  private createDecalSlot(): DecalSlot {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(DECAL_SIZE, DECAL_SIZE),
      new THREE.MeshLambertMaterial({ color: DECAL_COLOR }),
    );
    mesh.visible = false;
    this.scene.add(mesh);
    return { mesh };
  }

  // Efface tout effet appartenant à la partie qui se termine, sans détruire les pools persistants liés à la scène.
  resetSession(): void {
    this.shakePeak = 0;
    this.shakeElapsed = 0;
    this.shakeDurationActive = 0;

    for (const slot of this.muzzleFlashes) {
      slot.framesRemaining = 0;
      slot.light.visible = false;
      slot.quad.visible = false;
    }
    this.muzzleFlashCursor = 0;

    for (const slot of this.decals) slot.mesh.visible = false;
    this.decalCursor = 0;

    this.clearToyParticles(this.particles);
    this.clearToyParticles(this.casings);
    this.clearToyParticles(this.gibs);
    this.clearToyParticles(this.debris);
    this.clearToyParticles(this.frost);
    this.clearToyParticles(this.ceramic);
    this.clearToyParticles(this.waterBurst);
    this.clearWaterJets();
  }

  private clearToyParticles(list: ToyParticle[]): void {
    for (const particle of list) this.scene.remove(particle.mesh);
    list.length = 0;
  }

  // Relance avec le maximum de l’amplitude courante et du nouveau coup, sans sommation.
  triggerShake(amplitude: number, duration: number) {
    const current = this.currentShakeAmplitude();
    this.shakePeak = Math.max(current, amplitude);
    this.shakeElapsed = 0;
    this.shakeDurationActive = duration;
  }

  private currentShakeAmplitude(): number {
    if (this.shakePeak <= 0 || this.shakeDurationActive <= 0) return 0;
    if (this.shakeElapsed >= this.shakeDurationActive) return 0;
    const k = SHAKE_DECAY_RATE / this.shakeDurationActive;
    return this.shakePeak * Math.exp(-k * this.shakeElapsed);
  }

  // Flux cosmétique indépendant de la simulation, appliqué à la caméra.
  currentShakeOffset(out: THREE.Vector3): THREE.Vector3 {
    const amp = this.currentShakeAmplitude();
    if (amp <= 0) return out.set(0, 0, 0);

    const theta = this.random() * Math.PI * 2;
    const phi = Math.acos(2 * this.random() - 1);
    // La racine cubique répartit uniformément dans le volume, pas seulement sur la surface.
    const r = amp * Math.cbrt(this.random());
    const sinPhi = Math.sin(phi);
    out.set(r * sinPhi * Math.cos(theta), r * sinPhi * Math.sin(theta), r * Math.cos(phi));
    return out;
  }

  spawnMuzzleFlash(position: THREE.Vector3, direction: THREE.Vector3, weapon: "pistol" | "shotgun") {
    const preset = MUZZLE_FLASH_PRESETS[weapon];
    const slot = this.muzzleFlashes[this.muzzleFlashCursor]!;
    this.muzzleFlashCursor = (this.muzzleFlashCursor + 1) % this.muzzleFlashes.length;

    slot.light.position.copy(position).addScaledVector(direction, preset.offset);
    slot.light.color.setHex(preset.color);
    slot.light.intensity = preset.intensity;
    slot.light.distance = preset.range;
    slot.light.visible = true;

    slot.quad.position.copy(slot.light.position);
    slot.quad.material.emissive.setHex(preset.color);
    slot.quad.scale.setScalar(preset.size);
    // La normale du flash regarde à l’opposé du tir, vers le joueur.
    this.scratchDir.copy(direction).negate().normalize();
    slot.quad.quaternion.setFromUnitVectors(PLANE_DEFAULT_NORMAL, this.scratchDir);
    slot.quad.visible = true;

    slot.framesRemaining = MUZZLE_FLASH_FRAMES;
  }

  // Décor statique uniquement ; contrat garanti par l’appelant, material ignoré.
  spawnImpactDecal(point: THREE.Vector3, normal: THREE.Vector3, material: string) {
    void material;

    const slot = this.decals[this.decalCursor]!;
    this.decalCursor = (this.decalCursor + 1) % this.decals.length;

    slot.mesh.position.copy(point).addScaledVector(normal, DECAL_OFFSET);
    slot.mesh.quaternion.setFromUnitVectors(PLANE_DEFAULT_NORMAL, normal);
    slot.mesh.visible = true;
  }

  // Les particules sont libres : elles survivent à une surface déplacée ou cassée.
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

  // Chaque origine définit aussi son plan de retombée ; ne pas utiliser le sol global.
  addWaterJet(origin: THREE.Vector3) {
    const jetIndex = this.waterJetCursor;
    this.waterJetCursor = (this.waterJetCursor + 1) % WATER_MAX_JETS;

    const slot = this.waterJets[jetIndex]!;
    slot.active = true;
    slot.origin.copy(origin);
    slot.splashCursor = 0;
    this.updateWaterBounds();

    for (let d = 0; d < WATER_DROPLETS_PER_JET; d++) {
      const droplet = this.waterDroplets[jetIndex * WATER_DROPLETS_PER_JET + d]!;
      this.resetWaterDroplet(droplet, slot.origin);
      // Déphaser les gouttes évite une bouffée synchrone à l’allumage.
      const flight = this.random() * ((2 * droplet.velocity.y) / -TOY_GRAVITY);
      droplet.position.addScaledVector(droplet.velocity, flight);
      droplet.position.y += 0.5 * TOY_GRAVITY * flight * flight;
      droplet.velocity.y += TOY_GRAVITY * flight;
    }
    for (let s = 0; s < WATER_SPLASHES_PER_JET; s++) {
      this.waterSplashes[jetIndex * WATER_SPLASHES_PER_JET + s]!.life = 0;
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
    const slot = this.waterJets[jetIndex]!;
    const local = slot.splashCursor;
    slot.splashCursor = (slot.splashCursor + 1) % WATER_SPLASHES_PER_JET;

    const splash = this.waterSplashes[jetIndex * WATER_SPLASHES_PER_JET + local]!;
    splash.position.copy(slot.origin);
    splash.position.x += (this.random() * 2 - 1) * WATER_SPLASH_JITTER;
    splash.position.z += (this.random() * 2 - 1) * WATER_SPLASH_JITTER;
    splash.life = WATER_SPLASH_LIFETIME;
  }

  private spawnChunks(
    list: ToyParticle[],
    point: THREE.Vector3,
    direction: THREE.Vector3,
    geometry: THREE.BufferGeometry,
    material: THREE.MeshLambertMaterial,
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

  update(realDt: number) {
    this.shakeElapsed += realDt;

    for (const slot of this.muzzleFlashes) {
      if (slot.framesRemaining <= 0) continue;
      slot.framesRemaining -= 1;
      if (slot.framesRemaining <= 0) {
        slot.light.visible = false;
        slot.quad.visible = false;
      }
    }

    this.updateToyPhysics(this.particles, realDt);
    this.updateToyPhysics(this.casings, realDt);
    this.updateToyPhysics(this.gibs, realDt);
    this.updateToyPhysics(this.debris, realDt);
    this.updateToyPhysics(this.frost, realDt);
    this.updateToyPhysics(this.ceramic, realDt);
    this.updateToyPhysics(this.waterBurst, realDt);
    this.updateWaterJets(realDt);
  }

  private updateWaterJets(realDt: number) {
    let matricesDirty = false;

    for (let j = 0; j < WATER_MAX_JETS; j++) {
      const slot = this.waterJets[j]!;
      if (!slot.active) continue;
      matricesDirty = true;

      for (let d = 0; d < WATER_DROPLETS_PER_JET; d++) {
        const idx = j * WATER_DROPLETS_PER_JET + d;
        const droplet = this.waterDroplets[idx]!;

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
        const splash = this.waterSplashes[local]!;
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
}
