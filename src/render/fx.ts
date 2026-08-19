import * as THREE from "three";

/**
 * Effets visuels de tir : screenshake, muzzle flash, decals + particules
 * d'impact, douilles éjectées. Module PUREMENT cosmétique, tourne en temps
 * réel (`update(realDt)`, appelé depuis `updateFx` de `main.ts`), JAMAIS sur
 * le pas fixe — voir la note de tête de `core/loop.ts` sur pourquoi `updateFx`
 * reçoit `realDt` et pas `FIXED_DT`.
 *
 * DÉCOUPLAGE DÉLIBÉRÉ de `game/player/weapons.ts` : ce module n'importe rien
 * de la couche gameplay, il ne reçoit que des primitives (`THREE.Vector3`,
 * `"melee" | "shotgun"`, `string`). `main.ts` fait le pont en lisant
 * `weapons.fireEvents`/`hitEvents` et en dépaquetant leurs champs vers l'API
 * ci-dessous. Aucun état de simulation, aucun `Math.random()` seedé ici :
 * tout ce qui suit est transitoire, hors harnais de rejeu F9/F10 (le shake ne
 * modifie ni la position du joueur ni aucun état de simulation, seulement
 * l'affichage transitoire de la caméra).
 *
 * POOLING — trois régimes différents, volontairement pas uniformisés :
 *  - Muzzle flash : pool à taille FIXE de 2 (lumière + quad), round-robin.
 *    Largement suffisant : le pas fixe est clampé à 0.25 s (`MAX_FRAME` dans
 *    `core/loop.ts`) et les cooldowns d'armes (>= 0.5 s) rendent impossible
 *    plus d'UN `fireEvent` par frame d'affichage en régime normal.
 *  - Decals : pool à taille fixe (`DECAL_POOL_SIZE`), round-robin — un
 *    joueur qui vide un chargeur ne doit pas accumuler des dizaines de quads
 *    invisibles pour toujours.
 *  - Particules d'impact et douilles : tableaux simples filtrés à chaque
 *    `update()`, PAS de pool — leur durée de vie est courte (< 2 s) et le
 *    volume par tir est faible (quelques unités), un vrai pool serait de la
 *    sur-ingénierie pour un prototype à cette échelle.
 */

// ---------------------------------------------------------------------------
// Screenshake
// ---------------------------------------------------------------------------

/**
 * Fraction du pic d'amplitude considérée comme négligeable à la fin de la
 * fenêtre de décroissance. La constante de décroissance exponentielle est
 * dérivée de cette fraction et de la durée demandée à `triggerShake` :
 * `k = -ln(fraction) / duration`, donc à `t = duration`,
 * `amplitude(t) = pic * fraction`. Avec 0.05 (5 %) et une durée de 120 ms
 * (prescrite par le plan via `weaponConfig.shakeDuration`), l'effet est
 * revenu à 5 % de son pic en 120 ms pile — c'est la définition opérationnelle
 * de « décroissance exponentielle sur 120 ms » utilisée ici.
 */
const SHAKE_NEGLIGIBLE_FRACTION = 0.05;
const SHAKE_DECAY_RATE = -Math.log(SHAKE_NEGLIGIBLE_FRACTION); // ≈ 2.9957

// ---------------------------------------------------------------------------
// Muzzle flash
// ---------------------------------------------------------------------------

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
 * pousse quand même un `fireEvent` à chaque coup, et la spec de câblage
 * demande explicitement un muzzle flash pour CHAQUE tir, indépendamment de
 * l'arme (voir le câblage de `updateFx` dans `main.ts`). Interprété ici comme
 * une étincelle de choc au point de swing plutôt qu'un vrai flash d'arme à
 * feu : amplitude et taille nettement réduites par rapport au pompe.
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

// ---------------------------------------------------------------------------
// Decals d'impact
// ---------------------------------------------------------------------------

const DECAL_POOL_SIZE = 24;
const DECAL_SIZE = 0.12; // m
/** Détachement le long de la normale, évite le z-fighting avec la surface touchée. */
const DECAL_OFFSET = 0.01; // m
/** Marque sombre uniforme : aucun tag de matériau n'existe cette phase (gym en boîtes blanches, voir `weapons.ts`). */
const DECAL_COLOR = 0x1c1a18;

interface DecalSlot {
  mesh: THREE.Mesh;
}

// ---------------------------------------------------------------------------
// Particules d'impact et douilles — « physique jouet » temps réel
// ---------------------------------------------------------------------------

/**
 * Gravité jouet utilisée par les particules/douilles, en m/s². DÉLIBÉRÉMENT
 * dupliquée depuis `PhysicsWorld` (invariant #7, -25 m/s²) plutôt
 * qu'importée : ce module ne touche jamais Rapier (voir doc de tête), mais
 * réutilise la même magnitude pour que la chute cosmétique reste visuellement
 * cohérente avec le reste du monde (la balle témoin de `main.ts` tombe à la
 * même vitesse).
 */
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
 * APPROXIMATION ASSUMÉE : ce module ne fait AUCUNE requête Rapier (choix (b)
 * du plan — « physique jouet, pas de collision précise », sans toucher
 * Rapier du tout). `y = 0` est le niveau du sol du hub et du couloir de
 * `game/level/gym.ts` ; dans les ailes rampes/plateformes/escaliers une
 * douille peut visuellement traverser une marche avant de disparaître —
 * acceptable pour un débris cosmétique à durée de vie courte (1.6 s) dans
 * une gym boîtes blanches, pas pour un futur niveau avec sol texturé.
 */
const SHELL_GROUND_Y = 0;

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

  // --- Screenshake -----------------------------------------------------------
  private shakePeak = 0;
  private shakeElapsed = 0;
  private shakeDurationActive = 0;

  // --- Pools à taille fixe -----------------------------------------------------
  private readonly muzzleFlashes: MuzzleFlashSlot[] = [];
  private muzzleFlashCursor = 0;
  private readonly decals: DecalSlot[] = [];
  private decalCursor = 0;

  // --- Listes filtrées ---------------------------------------------------------
  private readonly particles: ToyParticle[] = [];
  private readonly casings: ToyParticle[] = [];

  // --- Scratch, zéro allocation en régime établi --------------------------------
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

  // ---------------------------------------------------------------------------
  // Screenshake
  // ---------------------------------------------------------------------------

  /**
   * (Re)démarre ou renforce le screenshake. Si un shake est déjà en cours
   * (typiquement : plusieurs plombs de pompe touchent dans le même pas fixe,
   * donc plusieurs `hitEvent` dans la même frame d'affichage), on NE SOMME
   * PAS les amplitudes — un impact à 9 plombs simultanés ne doit pas secouer
   * 9× plus fort qu'un seul. On prend le MAX de l'amplitude courante
   * (calculée à l'instant de l'appel, donc déjà partiellement décroissante si
   * le shake précédent avait commencé à s'estomper) et de la nouvelle
   * amplitude demandée, et on repart sur la durée pleine `duration`.
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

  // ---------------------------------------------------------------------------
  // Muzzle flash
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Decals d'impact
  // ---------------------------------------------------------------------------

  spawnImpactDecal(point: THREE.Vector3, normal: THREE.Vector3, material: string) {
    // `material` : placeholder pour un futur système de tag de matériau (voir
    // `PLACEHOLDER_MATERIAL` dans `weapons.ts`). Aucun n'existe cette phase,
    // donc aucune variation de couleur/texture par matériau ici — le
    // paramètre est conservé dans l'API pour ne pas devoir la changer plus
    // tard.
    void material;

    const slot = this.decals[this.decalCursor]!;
    this.decalCursor = (this.decalCursor + 1) % this.decals.length;

    slot.mesh.position.copy(point).addScaledVector(normal, DECAL_OFFSET);
    slot.mesh.quaternion.setFromUnitVectors(PLANE_DEFAULT_NORMAL, normal);
    slot.mesh.visible = true;
  }

  // ---------------------------------------------------------------------------
  // Particules d'impact
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Douilles éjectées
  // ---------------------------------------------------------------------------

  /**
   * Une douille par tir de POMPE (jamais pour le pied-de-biche, pas de
   * cartouche) — c'est `main.ts` qui filtre sur `fireEvent.weapon`, cette
   * méthode ne fait aucune hypothèse sur l'appelant.
   *
   * « Physique jouet, pas de collision précise », OPTION (b) du plan : aucune
   * interaction Rapier, mouvement balistique + rebond au sol supposé
   * (`SHELL_GROUND_Y`) géré entièrement ici en temps réel. Choisi plutôt que
   * l'option (a) (vrai `RigidBody` léger dans `COLLISION_GROUPS.DEBRIS`) pour
   * éviter la gestion de cycle de vie d'un corps physique (création, nettoyage
   * après quelques secondes, un pas de `world.step` de plus par douille) pour
   * un objet purement décoratif sans le moindre effet de gameplay — cohérent
   * avec le régime « temps réel affichage » déjà utilisé pour le shake et les
   * particules d'impact dans ce même module. `COLLISION_GROUPS.DEBRIS` reste
   * disponible tel quel dans `physics/world.ts` si un futur agent préfère
   * de vraies collisions.
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

  // ---------------------------------------------------------------------------
  // Update temps réel — jamais appelé depuis le pas fixe
  // ---------------------------------------------------------------------------

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
