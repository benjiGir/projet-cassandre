import * as THREE from "three";

/**
 * Effets visuels de tir : screenshake, muzzle flash, decals + particules
 * d'impact, douilles éjectées, gibs de mise à mort à bout portant. Module
 * PUREMENT cosmétique, tourne en temps réel (`update(realDt)`, appelé depuis
 * `game/loop/updateFx.ts`), JAMAIS sur le pas fixe.
 *
 * Découplage délibéré de `game/player/weapons.ts` (primitives uniquement,
 * aucun `Math.random()` seedé — hors harnais de rejeu F9/F10), trois régimes
 * de pooling volontairement pas uniformisés, et le choix de « physique
 * jouet » sans Rapier pour les débris cosmétiques (ADR 0018) :
 * see: docs/systems/rendu.md#découplage-entre-render-et-game
 * see: docs/systems/rendu.md#effets-visuels-de-tir-fxsystem
 */

// Screenshake

/**
 * Fraction du pic d'amplitude considérée négligeable à la fin de la fenêtre
 * de décroissance : `k = -ln(fraction) / duration`, donc à `t = duration`,
 * `amplitude(t) = pic * fraction`. Valeurs retenues :
 * see: docs/reference/valeurs-deplacement.md#impact
 */
const SHAKE_NEGLIGIBLE_FRACTION = 0.05;
const SHAKE_DECAY_RATE = -Math.log(SHAKE_NEGLIGIBLE_FRACTION); // ≈ 2.9957

// Muzzle flash

/** Nombre de FRAMES D'AFFICHAGE (pas de pas fixes) pendant lesquelles le flash reste visible. */
const MUZZLE_FLASH_FRAMES = 2;
const MUZZLE_FLASH_POOL_SIZE = 2;

interface MuzzleFlashPreset {
  color: number;
  /** Intensité de la `PointLight`, en candela (three.js physiquement correct depuis r155). Point de départ, tunable. */
  intensity: number;
  /** Portée de la lumière, en mètres. */
  range: number;
  /** Taille du quad (côté du carré), en mètres. */
  size: number;
  /** Décalage le long de `muzzleDirection` depuis `muzzlePosition`, en mètres. */
  offset: number;
}

/**
 * Un preset par arme. Le pied-de-biche N'A PAS DE CANON : `weapons.ts`
 * pousse quand même un `fireEvent` à chaque coup, et le câblage
 * (`game/loop/updateFx.ts`) demande un muzzle flash pour CHAQUE tir,
 * indépendamment de l'arme. Interprété ici comme une étincelle de choc au
 * point de swing plutôt qu'un vrai flash d'arme à feu : amplitude et taille
 * nettement réduites par rapport au pompe.
 */
const MUZZLE_FLASH_PRESETS: Record<"melee" | "shotgun", MuzzleFlashPreset> = {
  shotgun: { color: 0xfff2c0, intensity: 60, range: 6, size: 0.22, offset: 0.45 },
  melee: { color: 0xd8d8e8, intensity: 12, range: 2.5, size: 0.08, offset: 0.15 },
};

interface MuzzleFlashSlot {
  light: THREE.PointLight;
  quad: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  /** Frames d'affichage restantes avant extinction. 0 = éteint. */
  framesRemaining: number;
}

// Decals d'impact

const DECAL_POOL_SIZE = 24;
const DECAL_SIZE = 0.12; // m
/** Détachement le long de la normale, évite le z-fighting avec la surface touchée. */
const DECAL_OFFSET = 0.01; // m
/** Marque sombre uniforme : aucun tag de matériau n'existe cette phase (gym en boîtes blanches, voir `weapons.ts`). */
const DECAL_COLOR = 0x1c1a18;

interface DecalSlot {
  mesh: THREE.Mesh;
}

// Particules d'impact et douilles — « physique jouet » temps réel
// see: docs/decisions/0018-physique-jouet-debris-cosmetiques.md

/** Gravité jouet, en m/s². DÉLIBÉRÉMENT dupliquée depuis l'invariant #7 (-25 m/s²) plutôt qu'importée : ce module ne touche jamais Rapier, mais réutilise la même magnitude pour rester cohérent visuellement avec le reste du monde. */
const TOY_GRAVITY = -25;

const PARTICLE_LIFETIME = 0.4; // s
const PARTICLES_PER_HIT_MELEE = 4;
const PARTICLES_PER_HIT_SHOTGUN = 5;
const PARTICLE_SIZE = 0.03; // m
const PARTICLE_SPEED_MIN = 2; // m/s
const PARTICLE_SPEED_MAX = 5; // m/s
/** Ouverture du cône jouet autour de la normale (composante aléatoire, non seedée — cosmétique). */
const PARTICLE_SPREAD = 0.6;

const SHELL_LIFETIME = 1.6; // s
const SHELL_EJECT_SPEED = 1.8; // m/s, latéral
const SHELL_EJECT_UP_SPEED = 2.2; // m/s, vertical
const SHELL_RESTITUTION = 0.3;
const SHELL_FRICTION = 0.6;
/**
 * Hauteur de sol supposée pour le rebond des douilles, en mètres.
 * APPROXIMATION ASSUMÉE (aucune requête Rapier, voir ADR 0018) : `y = 0` est
 * le niveau du sol du hub/couloir de `game/level/gym.ts` — dans une zone
 * avec relief, une douille peut visuellement traverser une marche.
 * see: docs/decisions/0018-physique-jouet-debris-cosmetiques.md
 */
const SHELL_GROUND_Y = 0;

// Gibs — mort à bout portant (pompe). Réutilise `ToyParticle`/
// `updateToyPhysics` tel quel (`bounce: false`, pas de rebond, donc pas
// besoin de `SHELL_GROUND_Y` ici — voir la doc de tête).

const GIB_LIFETIME = 0.9; // s, plus long que PARTICLE_LIFETIME (chunks plus gros, chute plus lisible)
const GIBS_PER_KILL = 8;
const GIB_SIZE = 0.08; // m, cube de base — voir le scale non uniforme dans spawnGibs pour casser la silhouette
const GIB_SPEED_MIN = 3; // m/s
const GIB_SPEED_MAX = 7; // m/s
/** Cône jouet plus large que `PARTICLE_SPREAD` : « explosion » bout portant plutôt qu'un ricochet de plomb. */
const GIB_SPREAD = 0.9;
const GIB_COLOR = 0x3a120f; // rouge/brun sombre, nettement plus sombre que PARTICLE_MATERIAL

const GIB_GEOMETRY = new THREE.BoxGeometry(GIB_SIZE, GIB_SIZE, GIB_SIZE);
const GIB_MATERIAL = new THREE.MeshLambertMaterial({ color: GIB_COLOR });

interface ToyParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  /** Rebond au sol (douilles) ou disparition directe (particules d'impact). */
  bounce: boolean;
}

// Géométries/matériaux PARTAGÉS entre toutes les particules/douilles (comme
// `materialFor` dans `gym.ts`) : chaque `spawn*` alloue une nouvelle `Mesh`
// (léger, nécessaire vu la durée de vie/le mouvement individuels) mais
// jamais de nouvelle géométrie ni de nouveau matériau.
const PARTICLE_GEOMETRY = new THREE.BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);
const PARTICLE_MATERIAL = new THREE.MeshLambertMaterial({ color: 0x2c2620 });
const SHELL_GEOMETRY = new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6);
const SHELL_MATERIAL = new THREE.MeshLambertMaterial({ color: 0xc98a2c }); // laiton

/** Normale par défaut d'un `PlaneGeometry` non tourné (+Z). Réutilisée en lecture seule, jamais mutée. */
const PLANE_DEFAULT_NORMAL = new THREE.Vector3(0, 0, 1);

export class FxSystem {
  private readonly scene: THREE.Scene;

  // Screenshake
  private shakePeak = 0;
  private shakeElapsed = 0;
  private shakeDurationActive = 0;

  // Pools à taille fixe
  private readonly muzzleFlashes: MuzzleFlashSlot[] = [];
  private muzzleFlashCursor = 0;
  private readonly decals: DecalSlot[] = [];
  private decalCursor = 0;

  // Listes filtrées, pas de pool (voir la doc de tête)
  private readonly particles: ToyParticle[] = [];
  private readonly casings: ToyParticle[] = [];
  private readonly gibs: ToyParticle[] = [];

  // Scratch, zéro allocation en régime établi
  private readonly scratchDir = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    for (let i = 0; i < MUZZLE_FLASH_POOL_SIZE; i++) {
      this.muzzleFlashes.push(this.createMuzzleFlashSlot());
    }
    for (let i = 0; i < DECAL_POOL_SIZE; i++) {
      this.decals.push(this.createDecalSlot());
    }
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

  /**
   * (Re)démarre ou renforce le screenshake. PAS de sommation entre
   * déclenchements qui se chevauchent (voir la doc de tête) : le MAX de
   * l'amplitude courante (déjà partiellement décroissante) et de la nouvelle,
   * relancé sur la durée pleine `duration`.
   */
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

  /**
   * Offset courant à additionner à `camera.position`, tiré uniformément
   * dans une sphère de rayon = amplitude courante. `Math.random()` ordinaire
   * — voir la doc de tête, ceci est purement cosmétique et hors harnais de
   * déterminisme.
   */
  currentShakeOffset(out: THREE.Vector3): THREE.Vector3 {
    const amp = this.currentShakeAmplitude();
    if (amp <= 0) return out.set(0, 0, 0);

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    // Racine cubique : distribution uniforme en VOLUME dans la sphère (pas
    // seulement sur sa surface), cosmétique, précision de raison suffisante.
    const r = amp * Math.cbrt(Math.random());
    const sinPhi = Math.sin(phi);
    out.set(r * sinPhi * Math.cos(theta), r * sinPhi * Math.sin(theta), r * Math.cos(phi));
    return out;
  }

  // Muzzle flash

  spawnMuzzleFlash(position: THREE.Vector3, direction: THREE.Vector3, weapon: "melee" | "shotgun") {
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
    // Oriente le quad pour que sa normale (+Z par défaut) fasse face au
    // joueur : approximation qui suppose le joueur globalement à l'opposé de
    // `direction` depuis le point de tir — vrai par construction puisque
    // `muzzlePosition`/`muzzleDirection` viennent de l'œil du joueur
    // (`weapons.ts`), jamais d'une position rendue.
    this.scratchDir.copy(direction).negate().normalize();
    slot.quad.quaternion.setFromUnitVectors(PLANE_DEFAULT_NORMAL, this.scratchDir);
    slot.quad.visible = true;

    slot.framesRemaining = MUZZLE_FLASH_FRAMES;
  }

  // Decals d'impact

  spawnImpactDecal(point: THREE.Vector3, normal: THREE.Vector3, material: string) {
    // `material` : placeholder pour un futur tag de matériau (voir
    // `PLACEHOLDER_MATERIAL` dans `weapons.ts`) — conservé dans l'API pour ne
    // pas devoir la changer plus tard, sans effet cette phase.
    void material;

    const slot = this.decals[this.decalCursor]!;
    this.decalCursor = (this.decalCursor + 1) % this.decals.length;

    slot.mesh.position.copy(point).addScaledVector(normal, DECAL_OFFSET);
    slot.mesh.quaternion.setFromUnitVectors(PLANE_DEFAULT_NORMAL, normal);
    slot.mesh.visible = true;
  }

  // Particules d'impact

  spawnImpactParticles(point: THREE.Vector3, normal: THREE.Vector3, weapon: "melee" | "shotgun") {
    const count = weapon === "shotgun" ? PARTICLES_PER_HIT_SHOTGUN : PARTICLES_PER_HIT_MELEE;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(PARTICLE_GEOMETRY, PARTICLE_MATERIAL);
      mesh.position.copy(point);
      this.scene.add(mesh);

      // Cône jouet autour de la normale (réflexion approximative), plus une
      // légère composante ascendante. `Math.random()` ordinaire — cosmétique,
      // AUCUN rapport avec la dispersion seedée du pompe dans `weapons.ts`.
      const vx = normal.x + (Math.random() * 2 - 1) * PARTICLE_SPREAD;
      const vy = normal.y + (Math.random() * 2 - 1) * PARTICLE_SPREAD + 0.5;
      const vz = normal.z + (Math.random() * 2 - 1) * PARTICLE_SPREAD;
      const speed = PARTICLE_SPEED_MIN + Math.random() * (PARTICLE_SPEED_MAX - PARTICLE_SPEED_MIN);
      const velocity = new THREE.Vector3(vx, vy, vz).normalize().multiplyScalar(speed);

      this.particles.push({ mesh, velocity, life: PARTICLE_LIFETIME, bounce: false });
    }
  }

  // Douilles éjectées

  /**
   * Une douille par tir de POMPE (jamais pour le pied-de-biche, pas de
   * cartouche) — c'est `game/loop/updateFx.ts` qui filtre sur
   * `fireEvent.weapon`, cette méthode ne fait aucune hypothèse sur l'appelant.
   * Physique jouet, pas d'interaction Rapier : voir ADR 0018.
   * see: docs/decisions/0018-physique-jouet-debris-cosmetiques.md
   */
  spawnShellCasing(muzzlePosition: THREE.Vector3, muzzleDirection: THREE.Vector3) {
    const mesh = new THREE.Mesh(SHELL_GEOMETRY, SHELL_MATERIAL);
    mesh.position.copy(muzzlePosition);
    this.scene.add(mesh);

    // Éjection latérale approximative : perpendiculaire à la visée dans le
    // plan horizontal (rotation de 90° autour de Y). Repli sur +X mondial si
    // la visée est quasi verticale (composante horizontale dégénérée).
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
    this.casings.push({ mesh, velocity, life: SHELL_LIFETIME, bounce: true });
  }

  // Gibs — mort à bout portant. Réutilise `ToyParticle`/`updateToyPhysics`
  // (voir la doc de tête) : seuls géométrie, couleur, quantité, vitesse et
  // dispersion changent pour lire « chunk » plutôt que « éclat d'impact ».

  /**
   * @param point Position de l'entité tuée au moment du coup fatal (MONDE).
   * @param direction Direction du coup fatal, normalisée — direction DE BASE
   *   de la dispersion, comme `normal` dans `spawnImpactParticles`, mais sans
   *   besoin d'être une normale de surface (une explosion n'a pas de rebond).
   */
  spawnGibs(point: THREE.Vector3, direction: THREE.Vector3) {
    for (let i = 0; i < GIBS_PER_KILL; i++) {
      const mesh = new THREE.Mesh(GIB_GEOMETRY, GIB_MATERIAL);
      mesh.position.copy(point);
      // Scale non uniforme, purement cosmétique : casse la silhouette de
      // cube parfait pour lire « chunk » plutôt que « particule » à l'œil,
      // sans allouer de géométrie par gib (GIB_GEOMETRY reste partagée,
      // comme PARTICLE_GEOMETRY/SHELL_GEOMETRY plus haut).
      mesh.scale.set(0.6 + Math.random() * 0.8, 0.6 + Math.random() * 0.8, 0.6 + Math.random() * 0.8);
      this.scene.add(mesh);

      // Cône jouet autour de `direction`, plus large que celui des particules
      // d'impact (GIB_SPREAD > PARTICLE_SPREAD) et légèrement plus ascendant :
      // `Math.random()` ordinaire — cosmétique, hors harnais de déterminisme
      // (voir la doc de tête du fichier).
      const vx = direction.x + (Math.random() * 2 - 1) * GIB_SPREAD;
      const vy = direction.y + (Math.random() * 2 - 1) * GIB_SPREAD + 0.8;
      const vz = direction.z + (Math.random() * 2 - 1) * GIB_SPREAD;
      const speed = GIB_SPEED_MIN + Math.random() * (GIB_SPEED_MAX - GIB_SPEED_MIN);
      const velocity = new THREE.Vector3(vx, vy, vz).normalize().multiplyScalar(speed);

      this.gibs.push({ mesh, velocity, life: GIB_LIFETIME, bounce: false });
    }
  }

  // Update temps réel — jamais appelé depuis le pas fixe (voir la doc de tête)

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

      p.velocity.y += TOY_GRAVITY * realDt;
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
