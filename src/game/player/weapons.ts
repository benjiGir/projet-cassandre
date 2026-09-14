import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import type { InputFrame } from "../../core/inputRecorder";
import { DeterministicRandom } from "../../core/random";
import type { GameClock } from "../../core/time";
import { runGameplaySync } from "../../core/runtime";
import { RaycastService } from "../../physics/raycast";
import { COLLISION_GROUPS, GROUP, type PhysicsWorld } from "../../physics/world";
import { approach } from "./controller";
import { weaponConfig, type RecoilKick, type WeaponConfig } from "./weaponConfig";

const TAU = Math.PI * 2;

/** Valeur plafond des horloges du viewmodel : « il y a très longtemps ». */
const CLOCK_AT_REST = 1e3; // s

/** Horloges lues par le viewmodel, voir `WeaponSystem.viewmodelClocks`. */
export interface ViewmodelClocks {
  active: "none" | "melee" | "shotgun";
  /** Arme montrée avant le dernier changement. */
  previous: "none" | "melee" | "shotgun";
  sinceSwitch: number;
  sinceMeleeFire: number;
  sinceShotgunFire: number;
}

/**
 * Matériau de repli pour tout ce qui n'est pas un ennemi. La gym est en
 * boîtes blanches (invariant #9) : il n'existe aucun système de tag de
 * matériau par collider et il n'y en aura pas cette phase. Le champ
 * `HitEvent.material` reste un `string` libre pour qu'un futur système
 * puisse le peupler plus finement SANS changer l'API — construire un vrai
 * système de tags maintenant serait de la sur-ingénierie hors scope.
 * Phase 3 introduit la seule distinction qui compte déjà : ENEMY vs le
 * reste (voir `materialForCollider`).
 */
const PLACEHOLDER_MATERIAL = "concrete";

/**
 * SFX déclaré dans `core/audio.ts` pour un impact sur un ennemi (chair).
 * EXPORTÉE : `main.ts` en a besoin pour brancher le canal de feedback
 * ENEMY-vs-générique (hitstop/shake renforcés, `IMPACT_VARIANTS`) sur le
 * même critère que `materialForCollider` ci-dessous, sans dupliquer la
 * chaîne `"flesh"` en dur dans deux fichiers.
 */
export const FLESH_MATERIAL = "flesh";

/** Axe local le long duquel `RAPIER.Capsule` place sa demi-hauteur (voir sa doc) — sert à orienter la capsule de test du pied-de-biche sur la direction de visée dans `fireMelee`. */
const UNIT_Y = new THREE.Vector3(0, 1, 0);

/** Une arme effectivement déclenchée (jamais poussé sur tentative à sec/cooldown). */
export interface FireEvent {
  weapon: "melee" | "shotgun";
  /** Origine authentique du pas fixe (yeux, non bobée) — pas une position rendue. */
  muzzlePosition: THREE.Vector3;
  /** Direction de visée unitaire au moment du tir. */
  muzzleDirection: THREE.Vector3;
  /**
   * DEBUG UNIQUEMENT (gizmos balistiques, `render/ballisticsDebug.ts`) : un
   * point de fin par plomb du pompe, dans l'ordre des raycasts de
   * `fireShotgun` — le point d'impact réel s'il y en a un, sinon
   * `muzzlePosition + direction dispersée * shotgunRange`. Toujours de
   * longueur `shotgunPelletCount` pour un tir de pompe, `undefined` pour le
   * pied-de-biche (sa géométrie de test se déduit de `muzzlePosition` +
   * `muzzleDirection` + `weaponConfig.meleeRange`/`meleeHitRadius`, inutile
   * de dupliquer ces nombres ici). Zéro rôle dans le gameplay/déterminisme :
   * uniquement consommé par le rendu de debug dans `main.ts`.
   */
  pelletEndpoints?: THREE.Vector3[];
}

/** Un point d'impact réel. Jusqu'à `shotgunPelletCount` par tir de pompe dans UN pas fixe. */
export interface HitEvent {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  material: string;
  weapon: "melee" | "shotgun";
  /**
   * Handle Rapier (`RAPIER.Collider.handle`) du collider RÉELLEMENT touché.
   * Permet de router un dégât vers l'entité propriétaire sans dupliquer la
   * logique de tir (PRNG seedé, cône de dispersion) hors de ce fichier —
   * toute duplication casserait le déterminisme du rejeu F9/F10.
   */
  colliderHandle: number;
  /** Distance en mètres entre l'origine du tir et `point`. */
  distance: number;
}

// PRNG déterministe pour la dispersion du pompe, obtenu via
// `DeterministicRandom` (jamais une copie locale de mulberry32) — raison
// d'être de `forSeed` en fabrique plutôt qu'un flux partagé :
// see: docs/decisions/0007-rng-deterministe.md

/** Graine fixe et arbitraire — seule contrainte : ne JAMAIS dériver du temps réel ou de `Math.random`. */
const SHOTGUN_SPREAD_SEED = 0x9e3779b9;

/**
 * Armes du joueur : sélection, cooldowns, munitions du pompe, raycasts/tests
 * de forme, hitstop, et l'état de recul du viewmodel (nombres seulement,
 * aucun mesh/matériau/texture créé ici — c'est le travail de `retro-render`).
 * Architecture munitions (pool unique, pas de magasin) :
 * see: docs/systems/armes.md#architecture-munitions-un-seul-pool
 *
 * DISCIPLINE DE DÉTERMINISME (critique) : `update()` doit recevoir l'origine
 * de tir AUTHENTIQUE du pas fixe courant (`player.position` + `player.eyeOffset`)
 * et la direction de visée depuis `frame.yaw`/`frame.pitch` — JAMAIS des
 * valeurs interpolées pour le rendu (`player.eyePosition(alpha, …)`). Une
 * origine interpolée dépend du taux d'affichage et casserait silencieusement
 * le rejeu déterministe du raycast d'arme.
 */
export class WeaponSystem {
  /**
   * Arme sélectionnée. Lecture publique pour le débogage (`window.cassandre`,
   * futur panneau). `"none"` = joueur désarmé (voir `startUnarmed`) : le
   * bloc de tir de `update()` ne fait alors RIEN sur `frame.fire`, même
   * discipline que les tentatives à sec (cooldown, munitions à 0).
   *
   * Valeur de DÉPART inchangée (`"melee"`) : `gym.ts` (terrain de test Phase
   * 1-3) construit un `WeaponSystem` sans jamais appeler `startUnarmed()`, et
   * doit donc démarrer EXACTEMENT comme avant, armé du pied-de-biche.
   */
  activeWeapon: "none" | "melee" | "shotgun" = "melee";

  /** Munitions de pompe restantes. Lecture publique pour le débogage. */
  shotgunAmmo: number;

  /**
   * Le joueur possède-t-il le pied-de-biche ? `true` par défaut — encore une
   * fois pour ne rien casser pour `gym.ts`, qui n'appelle jamais
   * `startUnarmed()`. Passe à `false` via `startUnarmed()`, revient à `true`
   * via `pickUpMelee()`. Contrôle uniquement si `frame.switchToMelee` peut
   * (ré)armer le pied-de-biche et si le tir mêlée peut s'exécuter — voir
   * `update()`.
   */
  private hasMelee = true;

  /**
   * Le joueur possède-t-il le pompe ? `true` par défaut — même raison que
   * `hasMelee` (ne rien casser pour `gym.ts`/les zones B-E qui démarrent
   * déjà "armées" sans jamais appeler `startUnarmed()`). Passe à `false`
   * via `startUnarmed()`, revient à `true` via `pickUpShotgun()`. Comble un
   * écart documenté (le pompe n'avait jusqu'ici AUCUNE contrainte de
   * ramassage, toujours utilisable via `frame.switchToShotgun` même joueur
   * désarmé) — nécessaire pour que le niveau complet ait une vraie
   * progression (pied-de-biche en Zone A, pompe ramassé en Zone B).
   */
  private hasShotgun = true;

  private readonly physics: PhysicsWorld;
  private readonly clock: GameClock;
  private readonly cfg: WeaponConfig;

  private meleeCooldownRemaining = 0;
  private shotgunCooldownRemaining = 0;

  // Recul : enveloppe 0..1, même pattern que `bobIntensity` (approach() vers
  // 0, range=1). La FORME du kick (position + tangage) est celle de la
  // dernière arme tirée, snapshotée à l'instant du tir : elle ne varie qu'au
  // moment d'un nouveau tir, jamais entre deux pas fixes.
  private recoilEnvelope = 0;
  private previousRecoilEnvelope = 0;
  private readonly recoilKickPosition = new THREE.Vector3();
  private readonly previousRecoilKickPosition = new THREE.Vector3();
  private recoilKickPitch = 0; // radians
  private previousRecoilKickPitch = 0; // radians
  private recoilRecoverTime = 0;

  // Horloges du viewmodel (balayage, pompage, changement d'arme) : avancées
  // au pas fixe pour que le hitstop fige aussi l'arme, lues par le rendu
  // seul — AUCUNE ne conditionne un tir (invariant #10). Une valeur finie
  // plutôt qu'`Infinity` : l'interpolation `prev + (cur - prev) * alpha`
  // donnerait `NaN`.
  private sinceMeleeFire = CLOCK_AT_REST;
  private previousSinceMeleeFire = CLOCK_AT_REST;
  private sinceShotgunFire = CLOCK_AT_REST;
  private previousSinceShotgunFire = CLOCK_AT_REST;
  private sinceSwitch = CLOCK_AT_REST;
  private previousSinceSwitch = CLOCK_AT_REST;
  /** Arme que le viewmodel montrait avant le dernier changement. */
  private switchedFrom: "none" | "melee" | "shotgun" = "melee";
  /** Dernière arme vue par `update`, pour détecter un changement d'où qu'il vienne (touche, ramassage, désarmement). */
  private shownWeapon: "none" | "melee" | "shotgun" = "melee";

  // Files d'événements de la frame d'affichage courante, accumulées au fil
  // des pas fixes (une frame lente peut en exécuter plusieurs) : contrat
  // complet (qui lit, qui vide, dans quel ordre) —
  // see: docs/systems/armes.md#files-dévénements-de-frame-fireeventshitevents
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

  /**
   * Vide `fireEvents`/`hitEvents`. À appeler UNE SEULE FOIS par frame
   * d'affichage, EN TOUT DERNIER, après que tous les lecteurs ont fini —
   * même principe que `input.endFrame()`. Aujourd'hui, c'est `updateFx()`
   * (`src/game/loop/updateFx.ts`) qui tient ce rôle. `WeaponSystem` ne
   * s'appelle jamais elle-même : tant que personne d'autre ne l'appelle,
   * les événements s'accumulent sans déborder (juste plus de mémoire retenue).
   */
  clearFrameEvents() {
    this._fireEvents.length = 0;
    this._hitEvents.length = 0;
  }

  /** À appeler avant `update`, au même endroit que `player.snapshotPrevious()`. */
  snapshotPrevious() {
    this.previousSinceMeleeFire = this.sinceMeleeFire;
    this.previousSinceShotgunFire = this.sinceShotgunFire;
    this.previousSinceSwitch = this.sinceSwitch;
    this.previousRecoilEnvelope = this.recoilEnvelope;
    this.previousRecoilKickPosition.copy(this.recoilKickPosition);
    this.previousRecoilKickPitch = this.recoilKickPitch;
  }

  /**
   * Démarre le joueur désarmé : `hasMelee = false`, `activeWeapon = "none"`.
   * Level design (Zone A "Parking") : le pied-de-biche est un ramassage au
   * sol, donc le joueur ne peut pas commencer déjà équipé.
   *
   * CONTRAINTE D'APPEL, critique pour le déterminisme : DOIT être appelée de
   * façon SYNCHRONE par l'appelant, AVANT que `startLoop()` (`main.ts`) ne
   * commence à faire tourner le pas fixe — jamais depuis un callback
   * asynchrone de chargement de niveau (ex. résolution de promesse glTF), qui
   * arriverait après un nombre INDÉTERMINÉ de pas fixes déjà exécutés avec
   * l'arme par défaut (`"melee"`) active. Appeler cette méthode en retard ne
   * crashe rien mais désarme le joueur en cours de partie au lieu qu'il
   * démarre désarmé — un bug de timing silencieux, pas une erreur visible.
   */
  startUnarmed(): void {
    this.hasMelee = false;
    this.hasShotgun = false;
    this.activeWeapon = "none";
    this.shownWeapon = "none";
    this.switchedFrom = "none";
  }

  /**
   * Ramassage du pied-de-biche : `hasMelee = true`, et l'équipe immédiatement
   * (`activeWeapon = "melee"`) — cohérent avec le comportement par défaut de
   * `gym.ts` (toujours équipé) et avec l'attente boomer-shooter classique
   * (ramasser une arme l'équipe). Idempotente : rappeler cette méthode alors
   * que le pied-de-biche est déjà possédé et actif ne change rien.
   */
  pickUpMelee(): void {
    this.hasMelee = true;
    this.activeWeapon = "melee";
  }

  /** Ramassage du pompe : `hasShotgun = true`, équipé immédiatement — même contrat que `pickUpMelee`. Idempotente. */
  pickUpShotgun(): void {
    this.hasShotgun = true;
    this.activeWeapon = "shotgun";
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

  /** Horloges du viewmodel interpolées pour le rendu, écrites dans `out` — même modèle que `viewmodelPose`. */
  viewmodelClocks(alpha: number, out: ViewmodelClocks): ViewmodelClocks {
    out.active = this.activeWeapon;
    out.previous = this.switchedFrom;
    out.sinceSwitch = THREE.MathUtils.lerp(this.previousSinceSwitch, this.sinceSwitch, alpha);
    out.sinceMeleeFire = THREE.MathUtils.lerp(this.previousSinceMeleeFire, this.sinceMeleeFire, alpha);
    out.sinceShotgunFire = THREE.MathUtils.lerp(this.previousSinceShotgunFire, this.sinceShotgunFire, alpha);
    return out;
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

    this.sinceMeleeFire = Math.min(CLOCK_AT_REST, this.sinceMeleeFire + dt);
    this.sinceShotgunFire = Math.min(CLOCK_AT_REST, this.sinceShotgunFire + dt);
    this.sinceSwitch = Math.min(CLOCK_AT_REST, this.sinceSwitch + dt);

    this.meleeCooldownRemaining = Math.max(0, this.meleeCooldownRemaining - dt);
    this.shotgunCooldownRemaining = Math.max(0, this.shotgunCooldownRemaining - dt);

    // Le joueur ne peut pas se rééquiper d'une arme qu'il n'a pas ramassée en
    // appuyant sur `1` — sans garde, `frame.switchToMelee` réarmerait le
    // pied-de-biche pendant que le joueur est censé être désarmé.
    if (frame.switchToMelee && this.hasMelee) this.activeWeapon = "melee";
    if (frame.switchToShotgun && this.hasShotgun) this.activeWeapon = "shotgun";
    // Un ramassage (`pickUp*`, appelé par l'interaction APRÈS ce pas) est vu
    // au pas suivant : un pas de retard, invisible.
    if (this.activeWeapon !== this.shownWeapon) {
      this.switchedFrom = this.shownWeapon;
      this.shownWeapon = this.activeWeapon;
      this.sinceSwitch = 0;
    }

    // Récupération d'abord (comme `landingDip` dans `controller.ts`) : elle
    // décroît la valeur héritée du pas PRÉCÉDENT. Si ce pas-ci déclenche un
    // nouveau tir, le kick ci-dessous écrase le résultat et repart de 1 —
    // le nouveau tir garde donc sa pleine amplitude au moins un pas fixe,
    // au lieu d'être immédiatement rongé par la même décroissance.
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

  /**
   * Matériau perçu d'un collider touché : `"flesh"` si son appartenance
   * inclut `GROUP.ENEMY`, `PLACEHOLDER_MATERIAL` sinon. `collisionGroups()`
   * renvoie le masque `membership << 16 | filter` posé par
   * `setCollisionGroups` (voir les commentaires d'`interactionGroups` dans
   * `physics/world.ts`) — on ne lit ici QUE les 16 bits de poids fort
   * (appartenance), jamais le filtre.
   */
  private materialForCollider(collider: RAPIER.Collider): string {
    const membership = (collider.collisionGroups() >>> 16) & 0xffff;
    return (membership & GROUP.ENEMY) !== 0 ? FLESH_MATERIAL : PLACEHOLDER_MATERIAL;
  }

  /**
   * Déclenche le hitstop, en distinguant hit ENEMY (`FLESH_MATERIAL`) vs
   * générique — voir `IMPACT_VARIANTS` dans `weaponConfig.ts` pour le
   * contexte playtest (« aucun signal renforcé sur un hit ennemi ») et le
   * FAIT MÉCANIQUE vérifié : `clock.triggerHitstop` n'accumule JAMAIS entre
   * plusieurs appels du même pas fixe (dernier appel gagne), donc appeler
   * cette méthode jusqu'à `shotgunPelletCount` fois par tir ne « sur-arme »
   * rien — au pire les derniers pellets d'un même tir réécrivent la même
   * durée/échelle.
   */
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

  /**
   * Pied-de-biche : requête de FORME capsule couvrant tout le segment
   * `eyeOrigin` → `eyeOrigin + direction * meleeRange`, contre
   * `COLLISION_GROUPS.PLAYER_SHOT` (interagit avec WORLD + ENEMY, jamais
   * PLAYER). FIX DE PORTÉE constaté en playtest, pas un choix de feel :
   * l'ancienne sphère unique ne pouvait géométriquement pas toucher à bout
   * portant. Dérivation géométrique complète (construction de la capsule,
   * projection du point d'impact, approximation de la normale) :
   * see: docs/systems/armes.md#pied-de-biche-portée-en-capsule
   */
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

    // Jalon M3 (PLAN_EFFECT_XSTATE.md) : passe par `RaycastService`
    // (`src/physics/raycast.ts`), point d'entrée synchrone isolé — le
    // service collecte lui-même les colliders touchés dans un tableau
    // (plus besoin d'un scratch dédié ici, cet appel n'est pas un point
    // chaud à 60Hz, seulement à chaque coup de pied-de-biche).
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
      // Point de l'axe de visée le plus proche de CE collider : projection de
      // son centre monde sur le segment [eyeOrigin, eyeOrigin+direction*range],
      // clampée aux deux bouts. Remplace le centre fixe unique de l'ancienne
      // implémentation par un centre recalculé PAR COLLIDER — nécessaire
      // maintenant que la requête couvre tout un segment, pas un seul point.
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

  /**
   * Pompe : `shotgunPelletCount` raycasts indépendants, chacun dévié dans un
   * cône de demi-angle `shotgunSpreadConeDeg` autour de la visée. Échantillon
   * de disque projeté (rayon ∝ √u₁, azimut = u₂·2π) — approximation d'un
   * cône uniforme largement suffisante à 5°, tirée du PRNG seedé de ce
   * fichier (jamais `Math.random`).
   */
  private fireShotgun(eyeOrigin: THREE.Vector3, yaw: number, pitch: number) {
    this.computeAimBasis(yaw, pitch);

    // DEBUG UNIQUEMENT (voir la doc de `FireEvent.pelletEndpoints`) : la
    // RÉFÉRENCE au tableau est poussée dans `_fireEvents` immédiatement (même
    // point d'insertion que le pied-de-biche), son CONTENU est rempli au fil
    // de la boucle ci-dessous — sûr, car aucun lecteur (`main.ts`) ne
    // consulte `fireEvents` avant la fin de ce pas fixe.
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
        // Aucun collider touché : le gizmo balistique de debug dessine quand
        // même ce rayon jusqu'à sa portée max (voir la doc de
        // `pelletEndpoints`) — bout de trajectoire = origine + direction
        // dispersée * portée.
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

      // `hit.timeOfImpact` EST la distance : `pelletDirScratch` est normalisé
      // ci-dessus avant le `castRayAndGetNormal`, donc le paramètre du rayon
      // (`dir`) est un vecteur unitaire — `origin + dir * timeOfImpact` avance
      // de `timeOfImpact` mètres exactement.
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
