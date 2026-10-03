import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import type { WeaponKind, FireEvent, HitEvent, ViewmodelClocks } from "./weaponTypes";
import type { InputFrame } from "../../../core/input/inputTypes";
import { DeterministicRandom } from "../../../core/effect/random";
import type { GameClock } from "../../../core/loop/time";
import { runGameplaySync } from "../../../app/runtime/gameRuntime";
import { RaycastService } from "../../../physics/raycast";
import { COLLISION_GROUPS, GROUP, type PhysicsWorld } from "../../../physics/world";
import { approach } from "../movement/controller";
import { weaponConfig, type RecoilKick, type WeaponConfig } from "./weaponConfig";
const TAU = Math.PI * 2;

/** Valeur plafond des horloges du viewmodel : « il y a très longtemps ». */
const CLOCK_AT_REST = 1e3; // s


// see: docs/6-reference/notes-code-gameplay-joueur.md#contrats-des-armes
const PLACEHOLDER_MATERIAL = "concrete";

export const FLESH_MATERIAL = "flesh";

/** Axe local le long duquel `RAPIER.Capsule` place sa demi-hauteur (voir sa doc) — sert à orienter la capsule de test du pied-de-biche sur la direction de visée dans `fireMelee`. */
const UNIT_Y = new THREE.Vector3(0, 1, 0);



// see: docs/decisions/0007-rng-deterministe.md

/** Graine fixe et arbitraire — seule contrainte : ne JAMAIS dériver du temps réel ou de `Math.random`. */
const SHOTGUN_SPREAD_SEED = 0x9e3779b9;

// see: docs/archive/systems-armes.md#architecture-munitions-un-seul-pool



export class WeaponSystem {
  activeWeapon: WeaponKind = "melee";

  /** Munitions de pompe restantes. Lecture publique pour le débogage. */
  shotgunAmmo: number;

  /** Munitions de pistolet restantes, rechargées par les boîtes du niveau (`use_*` portant `munitions`). */
  pistolAmmo = 0;

  private hasMelee = true;

  private hasShotgun = true;

  private hasPistol = false;

  private readonly physics: PhysicsWorld;
  private readonly clock: GameClock;
  private readonly cfg: WeaponConfig;

  private meleeCooldownRemaining = 0;
  private pistolCooldownRemaining = 0;
  private shotgunCooldownRemaining = 0;

  private recoilEnvelope = 0;
  private previousRecoilEnvelope = 0;
  private readonly recoilKickPosition = new THREE.Vector3();
  private readonly previousRecoilKickPosition = new THREE.Vector3();
  private recoilKickPitch = 0; // radians
  private previousRecoilKickPitch = 0; // radians
  private recoilRecoverTime = 0;

  private sinceMeleeFire = CLOCK_AT_REST;
  private previousSinceMeleeFire = CLOCK_AT_REST;
  private sincePistolFire = CLOCK_AT_REST;
  private previousSincePistolFire = CLOCK_AT_REST;
  private sinceShotgunFire = CLOCK_AT_REST;
  private previousSinceShotgunFire = CLOCK_AT_REST;
  private sinceSwitch = CLOCK_AT_REST;
  private previousSinceSwitch = CLOCK_AT_REST;
  /** Arme que le viewmodel montrait avant le dernier changement. */
  private switchedFrom: WeaponKind = "melee";
  /** Dernière arme vue par `update`, pour détecter un changement d'où qu'il vienne (touche, ramassage, désarmement). */
  private shownWeapon: WeaponKind = "melee";

  // see: docs/archive/systems-armes.md#files-dévénements-de-frame-fireeventshitevents
  private readonly _fireEvents: FireEvent[] = [];
  private readonly _hitEvents: HitEvent[] = [];

  private readonly aimEuler = new THREE.Euler(0, 0, 0, "YXZ");
  private readonly aimQuat = new THREE.Quaternion();
  private readonly aimForward = new THREE.Vector3();
  private readonly aimRight = new THREE.Vector3();
  private readonly aimUp = new THREE.Vector3();
  private readonly meleeCenterScratch = new THREE.Vector3();
  private readonly meleeAxisPointScratch = new THREE.Vector3();
  private readonly meleeCapsuleQuat = new THREE.Quaternion();
  private readonly pelletDirScratch = new THREE.Vector3();
  private readonly scratchRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });

  private readonly nextRandom = runGameplaySync(
    DeterministicRandom.useSync((random) => random.forSeed(SHOTGUN_SPREAD_SEED)),
  );

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

  clearFrameEvents() {
    this._fireEvents.length = 0;
    this._hitEvents.length = 0;
  }

  /** À appeler avant `update`, au même endroit que `player.snapshotPrevious()`. */
  snapshotPrevious() {
    this.previousSinceMeleeFire = this.sinceMeleeFire;
    this.previousSincePistolFire = this.sincePistolFire;
    this.previousSinceShotgunFire = this.sinceShotgunFire;
    this.previousSinceSwitch = this.sinceSwitch;
    this.previousRecoilEnvelope = this.recoilEnvelope;
    this.previousRecoilKickPosition.copy(this.recoilKickPosition);
    this.previousRecoilKickPitch = this.recoilKickPitch;
  }

  startUnarmed(): void {
    this.hasMelee = false;
    this.hasPistol = false;
    this.hasShotgun = false;
    this.activeWeapon = "none";
    this.shownWeapon = "none";
    this.switchedFrom = "none";
  }

  pickUpMelee(): void {
    this.hasMelee = true;
    this.activeWeapon = "melee";
  }

  pickUpPistol(): void {
    if (!this.hasPistol) this.pistolAmmo = Math.min(this.cfg.pistolMaxAmmo, this.cfg.pistolStartingAmmo);
    this.hasPistol = true;
    this.activeWeapon = "pistol";
  }

  addPistolAmmo(amount: number): number {
    const before = this.pistolAmmo;
    this.pistolAmmo = Math.min(this.cfg.pistolMaxAmmo, this.pistolAmmo + amount);
    return this.pistolAmmo - before;
  }

  /** Ramassage du pompe : `hasShotgun = true`, équipé immédiatement — même contrat que `pickUpMelee`. Idempotente. */
  pickUpShotgun(): void {
    this.hasShotgun = true;
    this.activeWeapon = "shotgun";
  }

  tryCollectMelee(): boolean {
    if (this.hasMelee) return false;
    this.pickUpMelee();
    return true;
  }

  tryCollectShotgun(): boolean {
    if (this.hasShotgun) return false;
    this.pickUpShotgun();
    return true;
  }

  tryCollectPistol(): boolean {
    if (!this.hasPistol) {
      this.pickUpPistol();
      return true;
    }
    return this.addPistolAmmo(this.cfg.pistolStartingAmmo) > 0;
  }

  get hasPistolAlready(): boolean {
    return this.hasPistol;
  }

  viewmodelPose(alpha: number, outPosition: THREE.Vector3, outEuler: THREE.Euler): void {
    const t = THREE.MathUtils.lerp(this.previousRecoilEnvelope, this.recoilEnvelope, alpha);
    if (this.cfg.recoilPositionInterpolated) {
      outPosition.lerpVectors(this.previousRecoilKickPosition, this.recoilKickPosition, alpha);
    } else {
      outPosition.copy(this.recoilKickPosition);
    }
    outPosition.multiplyScalar(t);
    const pitch = THREE.MathUtils.lerp(this.previousRecoilKickPitch, this.recoilKickPitch, alpha);
    outEuler.set(pitch * t, 0, 0, "XYZ");
  }

  /** Horloges du viewmodel interpolées pour le rendu, écrites dans `out` — même modèle que `viewmodelPose`. */
  viewmodelClocks(alpha: number, out: ViewmodelClocks): ViewmodelClocks {
    out.active = this.activeWeapon;
    out.previous = this.switchedFrom;
    out.sinceSwitch = THREE.MathUtils.lerp(this.previousSinceSwitch, this.sinceSwitch, alpha);
    out.sinceMeleeFire = THREE.MathUtils.lerp(this.previousSinceMeleeFire, this.sinceMeleeFire, alpha);
    out.sincePistolFire = THREE.MathUtils.lerp(this.previousSincePistolFire, this.sincePistolFire, alpha);
    out.sinceShotgunFire = THREE.MathUtils.lerp(this.previousSinceShotgunFire, this.sinceShotgunFire, alpha);
    return out;
  }

  update(dt: number, frame: InputFrame, eyeOrigin: THREE.Vector3, yaw: number, pitch: number) {
    const cfg = this.cfg;

    this.sinceMeleeFire = Math.min(CLOCK_AT_REST, this.sinceMeleeFire + dt);
    this.sincePistolFire = Math.min(CLOCK_AT_REST, this.sincePistolFire + dt);
    this.sinceShotgunFire = Math.min(CLOCK_AT_REST, this.sinceShotgunFire + dt);
    this.sinceSwitch = Math.min(CLOCK_AT_REST, this.sinceSwitch + dt);

    this.meleeCooldownRemaining = Math.max(0, this.meleeCooldownRemaining - dt);
    this.pistolCooldownRemaining = Math.max(0, this.pistolCooldownRemaining - dt);
    this.shotgunCooldownRemaining = Math.max(0, this.shotgunCooldownRemaining - dt);

    // Le joueur ne peut pas se rééquiper d'une arme qu'il n'a pas ramassée en
    // appuyant sur `1` — sans garde, `frame.switchToMelee` réarmerait le
    // pied-de-biche pendant que le joueur est censé être désarmé.
    if (frame.switchToMelee && this.hasMelee) this.activeWeapon = "melee";
    if (frame.switchToPistol && this.hasPistol) this.activeWeapon = "pistol";
    if (frame.switchToShotgun && this.hasShotgun) this.activeWeapon = "shotgun";
    // Un ramassage (`pickUp*`, appelé par l'interaction APRÈS ce pas) est vu
    // au pas suivant : un pas de retard, invisible.
    if (this.activeWeapon !== this.shownWeapon) {
      this.switchedFrom = this.shownWeapon;
      this.shownWeapon = this.activeWeapon;
      this.sinceSwitch = 0;
    }

    this.recoilEnvelope = approach(this.recoilEnvelope, 0, this.recoilRecoverTime, dt, 1);

    if (frame.fire) {
      // Garde défensive explicite sur `hasMelee` : en théorie le garde du
      // switch ci-dessus empêche déjà `activeWeapon` de valoir `"melee"`
      // sans `hasMelee`, mais explicite vaut mieux qu'implicite ici.
      if (this.activeWeapon === "melee" && this.hasMelee) {
        if (this.meleeCooldownRemaining <= 0) {
          this.fireMelee(eyeOrigin, yaw, pitch);
          this.sinceMeleeFire = 0;
          this.meleeCooldownRemaining = cfg.meleeCooldown;
          this.applyKick(cfg.meleeRecoil);
        }
        // Sinon : cooldown non écoulé, tentative à sec — ne fait RIEN. Pas
        // de crash, pas d'animation bloquante (invariant #10).
      } else if (this.activeWeapon === "pistol" && this.hasPistol) {
        if (this.pistolCooldownRemaining <= 0 && this.pistolAmmo > 0) {
          this.firePistol(eyeOrigin, yaw, pitch);
          this.sincePistolFire = 0;
          this.pistolCooldownRemaining = cfg.pistolCooldown;
          this.pistolAmmo -= 1;
          this.applyKick(cfg.pistolRecoil);
        }
        // Sinon : cadence non écoulée OU chargeur vide — clic à sec, RAF.
      } else if (this.activeWeapon === "shotgun" && this.hasShotgun) {
        if (this.shotgunCooldownRemaining <= 0 && this.shotgunAmmo > 0) {
          this.fireShotgun(eyeOrigin, yaw, pitch);
          this.sinceShotgunFire = 0;
          this.shotgunCooldownRemaining = cfg.shotgunCooldown;
          this.shotgunAmmo -= 1;
          this.applyKick(cfg.shotgunRecoil);
        }
        // Sinon : cooldown non écoulé OU munitions à 0 — clic à sec, RAF.
        // (Un futur son de clic à sec est un stretch, cf. `weaponConfig.ts`.)
      }
      // Sinon (`activeWeapon === "none"`, joueur désarmé) : ne fait RIEN —
      // même discipline que les tentatives à sec ci-dessus. Pas de crash,
      // pas d'animation.
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

  private materialForCollider(collider: RAPIER.Collider): string {
    const membership = (collider.collisionGroups() >>> 16) & 0xffff;
    return (membership & GROUP.ENEMY) !== 0 ? FLESH_MATERIAL : PLACEHOLDER_MATERIAL;
  }

  private triggerHitstopFor(material: string) {
    const cfg = this.cfg;
    if (material === FLESH_MATERIAL) {
      this.clock.triggerHitstop(cfg.enemyHitstopDuration, cfg.enemyHitstopScale);
    } else {
      this.clock.triggerHitstop(cfg.hitstopDuration, cfg.hitstopScale);
    }
  }

  private applyKick(kick: RecoilKick) {
    this.recoilEnvelope = 1;
    this.recoilKickPosition.set(kick.kickX, kick.kickY, kick.kickZ);
    this.recoilKickPitch = THREE.MathUtils.degToRad(kick.kickPitchDeg);
    this.recoilRecoverTime = kick.recoverTime;
  }

  // see: docs/archive/systems-armes.md#pied-de-biche-portée-en-capsule
  private fireMelee(eyeOrigin: THREE.Vector3, yaw: number, pitch: number) {
    this.computeAimBasis(yaw, pitch);

    const range = this.cfg.meleeRange;
    const halfRange = range / 2;
    const radius = this.cfg.meleeHitRadius;

    const center = this.meleeCenterScratch.copy(eyeOrigin).addScaledVector(this.aimForward, halfRange);

    this._fireEvents.push({
      weapon: "melee",
      muzzlePosition: eyeOrigin.clone(),
      muzzleDirection: this.aimForward.clone(),
    });

    const shapePos = { x: center.x, y: center.y, z: center.z };
    // Rotation qui envoie l'axe local Y de la capsule (convention Rapier,
    // voir la doc ci-dessus) sur la direction de visée courante.
    this.meleeCapsuleQuat.setFromUnitVectors(UNIT_Y, this.aimForward);
    const shapeRot = {
      x: this.meleeCapsuleQuat.x,
      y: this.meleeCapsuleQuat.y,
      z: this.meleeCapsuleQuat.z,
      w: this.meleeCapsuleQuat.w,
    };
    const capsule = new RAPIER.Capsule(halfRange, radius);

    const meleeHits = runGameplaySync(
      RaycastService.use((raycast) =>
        raycast.intersectionsWithShape(
          this.physics,
          shapePos,
          shapeRot,
          capsule,
          RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
          COLLISION_GROUPS.PLAYER_SHOT,
        ),
      ),
    );

    for (const collider of meleeHits) {
      const colliderPos = collider.translation();
      const alongAxis =
        (colliderPos.x - eyeOrigin.x) * this.aimForward.x +
        (colliderPos.y - eyeOrigin.y) * this.aimForward.y +
        (colliderPos.z - eyeOrigin.z) * this.aimForward.z;
      const t = Math.max(0, Math.min(range, alongAxis));
      const axisPoint = this.meleeAxisPointScratch.copy(eyeOrigin).addScaledVector(this.aimForward, t);
      const axisPos = { x: axisPoint.x, y: axisPoint.y, z: axisPoint.z };

      const projection = this.physics.world.projectPoint(
        axisPos,
        false, // hollow : force la projection sur la surface même si le point est dedans.
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        COLLISION_GROUPS.PLAYER_SHOT,
        undefined,
        undefined,
        (c) => c.handle === collider.handle,
      );
      if (!projection) continue;

      const point = new THREE.Vector3(projection.point.x, projection.point.y, projection.point.z);
      const normal = new THREE.Vector3().subVectors(axisPoint, point);
      if (normal.lengthSq() < 1e-8) {
        // Dégénéré (point d'axe exactement sur la surface) : repli sur
        // l'inverse de la direction de visée plutôt qu'un vecteur nul.
        normal.copy(this.aimForward).negate();
      } else {
        normal.normalize();
      }

      const material = this.materialForCollider(collider);
      this._hitEvents.push({
        point,
        normal,
        material,
        weapon: "melee",
        colliderHandle: collider.handle,
        distance: eyeOrigin.distanceTo(point),
      });
      this.triggerHitstopFor(material);
    }
  }

  private firePistol(eyeOrigin: THREE.Vector3, yaw: number, pitch: number) {
    this.computeAimBasis(yaw, pitch);

    const pelletEndpoints: THREE.Vector3[] = [];
    this._fireEvents.push({
      weapon: "pistol",
      muzzlePosition: eyeOrigin.clone(),
      muzzleDirection: this.aimForward.clone(),
      pelletEndpoints,
    });

    const maxOffset = Math.tan(THREE.MathUtils.degToRad(this.cfg.pistolSpreadDeg));
    const radius = Math.sqrt(this.nextRandom()) * maxOffset;
    const angle = this.nextRandom() * TAU;
    this.pelletDirScratch
      .copy(this.aimForward)
      .addScaledVector(this.aimRight, Math.cos(angle) * radius)
      .addScaledVector(this.aimUp, Math.sin(angle) * radius)
      .normalize();

    this.scratchRay.origin.x = eyeOrigin.x;
    this.scratchRay.origin.y = eyeOrigin.y;
    this.scratchRay.origin.z = eyeOrigin.z;
    this.scratchRay.dir.x = this.pelletDirScratch.x;
    this.scratchRay.dir.y = this.pelletDirScratch.y;
    this.scratchRay.dir.z = this.pelletDirScratch.z;

    const hit = runGameplaySync(
      RaycastService.use((raycast) =>
        raycast.castRayAndGetNormal(
          this.physics,
          this.scratchRay,
          this.cfg.pistolRange,
          true,
          RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
          COLLISION_GROUPS.PLAYER_SHOT,
        ),
      ),
    );
    const portee = hit ? hit.timeOfImpact : this.cfg.pistolRange;
    const bout = new THREE.Vector3(
      eyeOrigin.x + this.pelletDirScratch.x * portee,
      eyeOrigin.y + this.pelletDirScratch.y * portee,
      eyeOrigin.z + this.pelletDirScratch.z * portee,
    );
    pelletEndpoints.push(bout);
    if (!hit) return;

    const material = this.materialForCollider(hit.collider);
    this._hitEvents.push({
      point: bout.clone(),
      normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
      material,
      weapon: "pistol",
      colliderHandle: hit.collider.handle,
      distance: hit.timeOfImpact,
    });
    this.triggerHitstopFor(material);
  }

  private fireShotgun(eyeOrigin: THREE.Vector3, yaw: number, pitch: number) {
    this.computeAimBasis(yaw, pitch);

    const pelletEndpoints: THREE.Vector3[] = [];
    this._fireEvents.push({
      weapon: "shotgun",
      muzzlePosition: eyeOrigin.clone(),
      muzzleDirection: this.aimForward.clone(),
      pelletEndpoints,
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

      // Jalon M3 (PLAN_EFFECT_XSTATE.md) : passe par `RaycastService`, un
      // point d'entrée synchrone isolé PAR PLOMB (pas de restructuration de
      // la boucle en un seul Effect composé — ça, c'est le rôle de M6).
      const hit = runGameplaySync(
        RaycastService.use((raycast) =>
          raycast.castRayAndGetNormal(
            this.physics,
            this.scratchRay,
            this.cfg.shotgunRange,
            true,
            RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
            COLLISION_GROUPS.PLAYER_SHOT,
          ),
        ),
      );
      if (!hit) {
        pelletEndpoints.push(
          new THREE.Vector3(
            ox + this.pelletDirScratch.x * this.cfg.shotgunRange,
            oy + this.pelletDirScratch.y * this.cfg.shotgunRange,
            oz + this.pelletDirScratch.z * this.cfg.shotgunRange,
          ),
        );
        continue;
      }

      const point = new THREE.Vector3(
        ox + this.pelletDirScratch.x * hit.timeOfImpact,
        oy + this.pelletDirScratch.y * hit.timeOfImpact,
        oz + this.pelletDirScratch.z * hit.timeOfImpact,
      );
      const normal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
      pelletEndpoints.push(point.clone());

      const material = this.materialForCollider(hit.collider);
      this._hitEvents.push({
        point,
        normal,
        material,
        weapon: "shotgun",
        colliderHandle: hit.collider.handle,
        distance: hit.timeOfImpact,
      });
      this.triggerHitstopFor(material);
    }
  }
}
