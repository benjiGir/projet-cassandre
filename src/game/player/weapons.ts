import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import type { InputFrame } from "../../core/inputRecorder";
import type { GameClock } from "../../core/time";
import { COLLISION_GROUPS, type PhysicsWorld } from "../../physics/world";
import { approach } from "./controller";
import { weaponConfig, type RecoilKick, type WeaponConfig } from "./weaponConfig";

const TAU = Math.PI * 2;

/**
 * Matériau d'impact placeholder. La gym est en boîtes blanches (invariant
 * #9) : il n'existe aucun système de tag de matériau et il n'y en aura pas
 * cette phase. Le champ `HitEvent.material` reste un `string` libre pour
 * qu'un futur système puisse le peupler SANS changer l'API — construire ce
 * système maintenant serait de la sur-ingénierie hors scope Phase 2.
 */
const PLACEHOLDER_MATERIAL = "concrete";

/** Rotation identité, structurellement compatible avec `Rotation` de Rapier ({x,y,z,w}). */
const IDENTITY_ROTATION = { x: 0, y: 0, z: 0, w: 1 };

/** Une arme effectivement déclenchée (jamais poussé sur tentative à sec/cooldown). */
export interface FireEvent {
  weapon: "melee" | "shotgun";
  /** Origine authentique du pas fixe (yeux, non bobée) — pas une position rendue. */
  muzzlePosition: THREE.Vector3;
  /** Direction de visée unitaire au moment du tir. */
  muzzleDirection: THREE.Vector3;
}

/** Un point d'impact réel. Jusqu'à `shotgunPelletCount` par tir de pompe dans UN pas fixe. */
export interface HitEvent {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  material: string;
  weapon: "melee" | "shotgun";
}

/**
 * PRNG déterministe (mulberry32), SEEDÉ par une constante fixe — jamais
 * `Math.random()` : la dispersion du pompe doit être rejouable à l'identique
 * par le harnais d'enregistrement/rejeu (F9/F10) et par tout futur harnais de
 * déterminisme. L'état n'avance qu'au fil des tirs réellement déclenchés,
 * donc deux rejeux de la même séquence d'`InputFrame` production exactement
 * la même dispersion, tir après tir.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Graine fixe et arbitraire — seule contrainte : ne JAMAIS dériver du temps réel ou de `Math.random`. */
const SHOTGUN_SPREAD_SEED = 0x9e3779b9;

/**
 * Armes du joueur : sélection, cooldowns, munitions du pompe, raycasts/tests
 * de forme, hitstop, et l'état de recul du viewmodel (nombres seulement,
 * aucun mesh/matériau/texture créé ici — c'est le travail de `retro-render`).
 *
 * DISCIPLINE DE DÉTERMINISME (critique) : `update()` doit recevoir l'origine
 * de tir AUTHENTIQUE du pas fixe courant (`player.position` + `player.eyeOffset`)
 * et la direction de visée depuis `frame.yaw`/`frame.pitch` — JAMAIS des
 * valeurs interpolées pour le rendu (`player.eyePosition(alpha, …)`). Une
 * origine interpolée dépend du taux d'affichage et casserait silencieusement
 * le rejeu déterministe du raycast d'arme.
 *
 * ARCHITECTURE MUNITIONS : un seul pool (`shotgunAmmo`), pas de distinction
 * magasin/réserve. `shotgunMagazineSize` (config) reste informatif — il n'y
 * a pas de mécanique de rechargement à construire cette phase : chaque tir
 * se « réarme » automatiquement via `shotgunCooldown`, ce qui satisfait déjà
 * le piège du plan (« le pompe se réarme pendant qu'on bouge », invariant
 * #10) sans machine à états de rechargement. Un système de chargeur réel
 * (rechargement manuel, munitions par lot) est un candidat naturel pour
 * Phase 6 (HUD) s'il s'avère nécessaire au feel — pas trancher ici.
 */
export class WeaponSystem {
  /** Arme sélectionnée. Lecture publique pour le débogage (`window.cassandre`, futur panneau). */
  activeWeapon: "melee" | "shotgun" = "melee";

  /** Munitions de pompe restantes. Lecture publique pour le débogage. */
  shotgunAmmo: number;

  private readonly physics: PhysicsWorld;
  private readonly clock: GameClock;
  private readonly cfg: WeaponConfig;

  private meleeCooldownRemaining = 0;
  private shotgunCooldownRemaining = 0;

  // --- Recul : enveloppe 0..1, MÊME PATTERN que `bobIntensity` -------------
  // (approach() vers 0, range=1). La FORME du kick (position + tangage) est
  // celle de la dernière arme tirée, snapshotée à l'instant du tir : elle ne
  // varie qu'au moment d'un nouveau tir, jamais entre deux pas fixes.
  private recoilEnvelope = 0;
  private previousRecoilEnvelope = 0;
  private readonly recoilKickPosition = new THREE.Vector3();
  private readonly previousRecoilKickPosition = new THREE.Vector3();
  private recoilKickPitch = 0; // radians
  private previousRecoilKickPitch = 0; // radians
  private recoilRecoverTime = 0;

  // --- Files d'événements de la frame d'affichage courante ------------------
  // ACCUMULÉES au fil des pas fixes d'une même frame (une frame lente peut
  // exécuter plusieurs pas fixes = plusieurs tirs). Ne s'auto-vident JAMAIS à
  // la lecture : `retro-render` ET `shell` lisent le même contenu dans la
  // même frame. Seul `clearFrameEvents()` les vide, et seul `shell` doit
  // l'appeler, en tout dernier — voir sa doc plus bas.
  private readonly _fireEvents: FireEvent[] = [];
  private readonly _hitEvents: HitEvent[] = [];

  // --- Scratch, zéro allocation en régime établi ----------------------------
  private readonly aimEuler = new THREE.Euler(0, 0, 0, "YXZ");
  private readonly aimQuat = new THREE.Quaternion();
  private readonly aimForward = new THREE.Vector3();
  private readonly aimRight = new THREE.Vector3();
  private readonly aimUp = new THREE.Vector3();
  private readonly meleeCenterScratch = new THREE.Vector3();
  private readonly meleeHitScratch: RAPIER.Collider[] = [];
  private readonly pelletDirScratch = new THREE.Vector3();
  private readonly scratchRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });

  private readonly nextRandom = mulberry32(SHOTGUN_SPREAD_SEED);

  constructor(physics: PhysicsWorld, clock: GameClock, cfg: WeaponConfig = weaponConfig) {
    this.physics = physics;
    this.clock = clock;
    this.cfg = cfg;
    this.shotgunAmmo = cfg.shotgunStartingAmmo;
  }

  /** Files de tir de la frame d'affichage courante. Lecture non destructive, plusieurs lecteurs indépendants. */
  get fireEvents(): ReadonlyArray<FireEvent> {
    return this._fireEvents;
  }

  /** Files d'impact de la frame d'affichage courante. Même contrat que `fireEvents`. */
  get hitEvents(): ReadonlyArray<HitEvent> {
    return this._hitEvents;
  }

  /**
   * Vide `fireEvents`/`hitEvents`. À appeler UNE SEULE FOIS par frame
   * d'affichage, EN TOUT DERNIER, par le dernier agent de la chaîne
   * d'événements (`shell`, après `retro-render`) — même principe que
   * `input.endFrame()`. `WeaponSystem` ne s'appelle JAMAIS elle-même : tant
   * que personne d'autre ne l'appelle, les événements s'accumulent, et
   * c'est le comportement ATTENDU en sortie de Phase 2 (personne ne lit
   * encore ces files).
   */
  clearFrameEvents() {
    this._fireEvents.length = 0;
    this._hitEvents.length = 0;
  }

  /** À appeler avant `update`, au même endroit que `player.snapshotPrevious()`. */
  snapshotPrevious() {
    this.previousRecoilEnvelope = this.recoilEnvelope;
    this.previousRecoilKickPosition.copy(this.recoilKickPosition);
    this.previousRecoilKickPitch = this.recoilKickPitch;
  }

  /**
   * Pose de recul du viewmodel interpolée pour le rendu, EXACTEMENT sur le
   * modèle de `PlayerController.viewBob(alpha, out)` (prev/current + lerp).
   * `retro-render` l'utilise pour positionner son mesh/sprite d'arme — ce ne
   * sont que des nombres, aucun objet Three.js visuel n'est créé ici.
   */
  viewmodelPose(alpha: number, outPosition: THREE.Vector3, outEuler: THREE.Euler): void {
    const t = THREE.MathUtils.lerp(this.previousRecoilEnvelope, this.recoilEnvelope, alpha);
    outPosition.set(
      this.recoilKickPosition.x * t,
      this.recoilKickPosition.y * t,
      this.recoilKickPosition.z * t,
    );
    // Interpole aussi la FORME du kick (au cas où un nouveau tir a changé
    // d'arme entre deux pas fixes de la même frame) : cosmétique seulement,
    // aucune conséquence de gameplay, mais évite un saut visible sur ce cas
    // marginal.
    const pitch = THREE.MathUtils.lerp(this.previousRecoilKickPitch, this.recoilKickPitch, alpha);
    outEuler.set(pitch * t, 0, 0, "XYZ");
  }

  /**
   * Un pas fixe d'armes. `dt` est le dt de GAMEPLAY (déjà scalé par le
   * hitstop) — jamais d'horloge murale ici, tout se rejoue à l'identique.
   *
   * `eyeOrigin`/`yaw`/`pitch` : voir la note de déterminisme en tête de
   * classe. Appelé depuis `updateGameplay` de `main.ts`, APRÈS `player.update`.
   */
  update(dt: number, frame: InputFrame, eyeOrigin: THREE.Vector3, yaw: number, pitch: number) {
    const cfg = this.cfg;

    this.meleeCooldownRemaining = Math.max(0, this.meleeCooldownRemaining - dt);
    this.shotgunCooldownRemaining = Math.max(0, this.shotgunCooldownRemaining - dt);

    if (frame.switchToMelee) this.activeWeapon = "melee";
    if (frame.switchToShotgun) this.activeWeapon = "shotgun";

    // Récupération d'abord (comme `landingDip` dans `controller.ts`) : elle
    // décroît la valeur héritée du pas PRÉCÉDENT. Si ce pas-ci déclenche un
    // nouveau tir, le kick ci-dessous écrase le résultat et repart de 1 —
    // le nouveau tir garde donc sa pleine amplitude au moins un pas fixe,
    // au lieu d'être immédiatement rongé par la même décroissance.
    this.recoilEnvelope = approach(this.recoilEnvelope, 0, this.recoilRecoverTime, dt, 1);

    if (frame.fire) {
      if (this.activeWeapon === "melee") {
        if (this.meleeCooldownRemaining <= 0) {
          this.fireMelee(eyeOrigin, yaw, pitch);
          this.meleeCooldownRemaining = cfg.meleeCooldown;
          this.applyKick(cfg.meleeRecoil);
        }
        // Sinon : cooldown non écoulé, tentative à sec — ne fait RIEN. Pas
        // de crash, pas d'animation bloquante (invariant #10).
      } else {
        if (this.shotgunCooldownRemaining <= 0 && this.shotgunAmmo > 0) {
          this.fireShotgun(eyeOrigin, yaw, pitch);
          this.shotgunCooldownRemaining = cfg.shotgunCooldown;
          this.shotgunAmmo -= 1;
          this.applyKick(cfg.shotgunRecoil);
        }
        // Sinon : cooldown non écoulé OU munitions à 0 — clic à sec, RAF.
        // (Un futur son de clic à sec est un stretch, cf. `weaponConfig.ts`.)
      }
    }
  }

  /** Direction de visée + base orthonormée (droite/haut), dérivées de yaw/pitch — MÊME convention que la caméra (`main.ts`, Euler 'YXZ'). */
  private computeAimBasis(yaw: number, pitch: number) {
    this.aimEuler.set(pitch, yaw, 0);
    this.aimQuat.setFromEuler(this.aimEuler);
    this.aimForward.set(0, 0, -1).applyQuaternion(this.aimQuat);
    this.aimRight.set(1, 0, 0).applyQuaternion(this.aimQuat);
    this.aimUp.set(0, 1, 0).applyQuaternion(this.aimQuat);
  }

  private applyKick(kick: RecoilKick) {
    this.recoilEnvelope = 1;
    this.recoilKickPosition.set(kick.kickX, kick.kickY, kick.kickZ);
    this.recoilKickPitch = THREE.MathUtils.degToRad(kick.kickPitchDeg);
    this.recoilRecoverTime = kick.recoverTime;
  }

  /**
   * Pied-de-biche : requête de FORME sphérique (rayon `meleeHitRadius`),
   * centrée à `eyeOrigin + direction * meleeRange`, contre
   * `COLLISION_GROUPS.PLAYER_SHOT` (interagit avec WORLD + ENEMY, jamais
   * PLAYER — le joueur ne peut pas se toucher lui-même par construction des
   * groupes, aucun filtre d'exclusion supplémentaire n'est nécessaire).
   *
   * `intersectionsWithShape` ne donne QUE les colliders touchés, pas de
   * point/normale d'impact. Pour chacun, `projectPoint(…, solid=false)`
   * projette le centre de la sphère sur la surface du collider (jamais à
   * l'intérieur, même si le centre y est) : c'est le point d'impact. La
   * normale est APPROXIMÉE par `normalize(centre − point)` — direction du
   * point de surface vers le centre de la sphère de frappe, inversée : une
   * approximation standard et correcte pour une surface convexe (murs/boîtes
   * de la gym), documentée ici pour que personne ne la prenne pour une
   * normale géométrique exacte issue du solveur de contact.
   */
  private fireMelee(eyeOrigin: THREE.Vector3, yaw: number, pitch: number) {
    this.computeAimBasis(yaw, pitch);

    const center = this.meleeCenterScratch
      .copy(eyeOrigin)
      .addScaledVector(this.aimForward, this.cfg.meleeRange);

    this._fireEvents.push({
      weapon: "melee",
      muzzlePosition: eyeOrigin.clone(),
      muzzleDirection: this.aimForward.clone(),
    });

    const shapePos = { x: center.x, y: center.y, z: center.z };
    const ball = new RAPIER.Ball(this.cfg.meleeHitRadius);

    this.meleeHitScratch.length = 0;
    this.physics.world.intersectionsWithShape(
      shapePos,
      IDENTITY_ROTATION,
      ball,
      (collider) => {
        this.meleeHitScratch.push(collider);
        return true; // continue : on veut TOUS les colliders touchés, pas seulement le premier.
      },
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      COLLISION_GROUPS.PLAYER_SHOT,
    );

    for (const collider of this.meleeHitScratch) {
      const projection = this.physics.world.projectPoint(
        shapePos,
        false, // hollow : force la projection sur la surface même si le centre est dedans.
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        COLLISION_GROUPS.PLAYER_SHOT,
        undefined,
        undefined,
        (c) => c.handle === collider.handle,
      );
      if (!projection) continue;

      const point = new THREE.Vector3(projection.point.x, projection.point.y, projection.point.z);
      const normal = new THREE.Vector3().subVectors(center, point);
      if (normal.lengthSq() < 1e-8) {
        // Dégénéré (centre exactement sur la surface) : repli sur l'inverse
        // de la direction de visée plutôt qu'un vecteur nul.
        normal.copy(this.aimForward).negate();
      } else {
        normal.normalize();
      }

      this._hitEvents.push({ point, normal, material: PLACEHOLDER_MATERIAL, weapon: "melee" });
      this.clock.triggerHitstop(this.cfg.hitstopDuration, this.cfg.hitstopScale);
    }
  }

  /**
   * Pompe : `shotgunPelletCount` raycasts indépendants, chacun dévié dans un
   * cône de demi-angle `shotgunSpreadConeDeg` autour de la visée. Échantillon
   * de disque projeté (rayon ∝ √u₁, azimut = u₂·2π) — approximation d'un
   * cône uniforme largement suffisante à 5°, tirée du PRNG seedé de ce
   * fichier (jamais `Math.random`).
   */
  private fireShotgun(eyeOrigin: THREE.Vector3, yaw: number, pitch: number) {
    this.computeAimBasis(yaw, pitch);

    this._fireEvents.push({
      weapon: "shotgun",
      muzzlePosition: eyeOrigin.clone(),
      muzzleDirection: this.aimForward.clone(),
    });

    const thetaMax = THREE.MathUtils.degToRad(this.cfg.shotgunSpreadConeDeg);
    const maxOffset = Math.tan(thetaMax);
    const ox = eyeOrigin.x;
    const oy = eyeOrigin.y;
    const oz = eyeOrigin.z;

    for (let i = 0; i < this.cfg.shotgunPelletCount; i++) {
      const u1 = this.nextRandom();
      const u2 = this.nextRandom();
      const radius = Math.sqrt(u1) * maxOffset;
      const angle = u2 * TAU;

      this.pelletDirScratch
        .copy(this.aimForward)
        .addScaledVector(this.aimRight, Math.cos(angle) * radius)
        .addScaledVector(this.aimUp, Math.sin(angle) * radius)
        .normalize();

      this.scratchRay.origin.x = ox;
      this.scratchRay.origin.y = oy;
      this.scratchRay.origin.z = oz;
      this.scratchRay.dir.x = this.pelletDirScratch.x;
      this.scratchRay.dir.y = this.pelletDirScratch.y;
      this.scratchRay.dir.z = this.pelletDirScratch.z;

      const hit = this.physics.world.castRayAndGetNormal(
        this.scratchRay,
        this.cfg.shotgunRange,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        COLLISION_GROUPS.PLAYER_SHOT,
      );
      if (!hit) continue;

      const point = new THREE.Vector3(
        ox + this.pelletDirScratch.x * hit.timeOfImpact,
        oy + this.pelletDirScratch.y * hit.timeOfImpact,
        oz + this.pelletDirScratch.z * hit.timeOfImpact,
      );
      const normal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);

      this._hitEvents.push({ point, normal, material: PLACEHOLDER_MATERIAL, weapon: "shotgun" });
      this.clock.triggerHitstop(this.cfg.hitstopDuration, this.cfg.hitstopScale);
    }
  }
}
