import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { runGameplaySync } from "../../core/runtime";
import { RaycastService } from "../../physics/raycast";
import { COLLISION_GROUPS, GROUP, interactionGroups, type PhysicsWorld } from "../../physics/world";
import { allocateEntityId, type Entity } from "./entity";
import { suitConfig as defaultSuitConfig, type SuitConfig } from "./suitConfig";

const TAU = Math.PI * 2;

/**
 * L'ennemi « Costard » — Phase 3 (`enemy-state-machine`, `billboard-sprites-8dir`).
 *
 * PURETÉ DU CŒUR DE SIMULATION (même discipline que `PlayerController` et
 * `WeaponSystem`) : ce fichier n'importe RIEN de `render/billboard.ts`,
 * `render/fx.ts`, `core/audio.ts`, ni `game/state.ts`. `Suit.update()` ne
 * fait qu'avancer sa propre machine à états et sa physique ; il expose des
 * champs `pending*` (voir plus bas) que `SuitManager` lit et traduit en
 * événements accumulés — c'est `main.ts` qui, à travers `SuitManager`,
 * possède les `BillboardSprite`/appels `fx`/`audio`/`state`, jamais ce
 * fichier.
 *
 * DÉTERMINISME : tout ici tourne au pas fixe, avec le `dt` de GAMEPLAY reçu
 * en paramètre (jamais d'horloge murale). La seule source de hasard
 * (`aimJitterDeg`) passe par un PRNG mulberry32 seedé PAR ENTITÉ — jamais
 * `Math.random()` — voir `nextRandom`.
 *
 * DÉPLACEMENT : `RAPIER.KinematicCharacterController` (invariant #6), jamais
 * de résolution capsule-vs-monde maison. Contrairement à `PlayerController`,
 * chaque `Suit` NE POSSÈDE PAS son propre `KinematicCharacterController` :
 * `SuitManager` en crée UNE SEULE instance partagée par tous les Costards
 * (le skill `rapier-character-controller` documente explicitement qu'« une
 * seule instance peut piloter plusieurs personnages ») et la passe dans
 * `SuitUpdateContext.kcc` à chaque appel. C'est sûr en JS single-thread :
 * `computeColliderMovement` puis la lecture immédiate de son résultat
 * (`computedMovement`/`computedGrounded`) sont toujours consommés avant que
 * le Costard suivant ne réutilise le même contrôleur, donc aucun état ne
 * fuit d'un Costard à l'autre.
 */

// ---------------------------------------------------------------------------
// Groupes de raycast — dérivés localement de `GROUP`/`interactionGroups`
// (déjà exportés par `physics/world.ts`, aucune modification de ce fichier).
// ---------------------------------------------------------------------------

/**
 * Filtre « rayon d'ENEMY qui ne teste QUE la géométrie du niveau » — réutilisé
 * pour la ligne de vue (IDLE -> ALERTE, perte de contact, re-vérification
 * avant de tirer) ET les 3 rayons d'évitement de trajectoire. Membership
 * ENEMY, filtre WORLD SEUL : ne peut jamais toucher le joueur ni un autre
 * Costard (leurs colliders ne portent pas le bit WORLD), exactement la
 * garantie demandée par la tâche (« ne doit pas être bloquée par le joueur
 * lui-même ni par un autre Costard — seule la géométrie du niveau compte »).
 */
const WORLD_ONLY_RAY_GROUPS = interactionGroups(GROUP.ENEMY, GROUP.WORLD);

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_RIGHT_FALLBACK = new THREE.Vector3(1, 0, 0);

/** Nombre de frames de l'animation de mort (deliverable Phase 3 : 4 frames). */
export const DEATH_FRAME_COUNT = 4;

/**
 * Nombre de lignes de l'atlas 8×N attendu par `createPlaceholderAtlas`/
 * `BillboardSprite` : 5 poses d'état distinctes (IDLE, ALERTE, POURSUITE,
 * TIR, RECUL) + 4 frames de mort dédiées (CADAVRE réutilise la dernière).
 * Choix documenté : lignes plutôt que colonnes pour les frames de mort — les
 * colonnes sont déjà réservées aux 8 directions par le système de billboard,
 * seules les LIGNES sont libres pour ajouter des poses/frames.
 */
export const SUIT_ATLAS_ROWS = 5 + DEATH_FRAME_COUNT;

/** États de la machine, mappés sur les noms français du plan/skill en commentaire. */
export type SuitState =
  | "idle" // IDLE
  | "alert" // ALERTE
  | "chase" // POURSUITE
  | "attack" // TIR
  | "stagger" // RECUL
  | "dead" // MORT
  | "corpse"; // CADAVRE

/** Ligne d'atlas par état vivant — CHAQUE état a une ligne distincte (skill : "un état invisible pour le joueur est un état inutile"). */
const LIVE_STATE_ROW: Record<Exclude<SuitState, "dead" | "corpse">, number> = {
  idle: 0,
  alert: 1,
  chase: 2,
  attack: 3,
  stagger: 4,
};
const DEATH_ROW_BASE = 5;

/** Exposée pour documentation/débogage (`cassandre.suitConfig`, mosaïque de diagnostic). */
export const SUIT_STATE_ROWS = {
  ...LIVE_STATE_ROW,
  deathBase: DEATH_ROW_BASE,
} as const;

/**
 * Contexte partagé injecté à chaque `Suit.update()` par `SuitManager` — pas
 * de référence à `PlayerController` ici (romprait la pureté), uniquement des
 * primitives déjà lues par l'appelant.
 */
export interface SuitUpdateContext {
  physics: PhysicsWorld;
  /** Contrôleur PARTAGÉ, voir la doc de tête. */
  kcc: RAPIER.KinematicCharacterController;
  /** Position visée pour la poursuite (XZ utilisé, Y ignoré/aplati en interne). */
  playerTargetPosition: THREE.Vector3;
  /** Origine AUTHENTIQUE des yeux du joueur au pas fixe courant (jamais interpolée) — cible de la ligne de vue et de l'attaque. */
  playerEyePosition: THREE.Vector3;
}

/** PRNG déterministe, MÊME algorithme que `weapons.ts` (mulberry32) — une instance PAR ENTITÉ, jamais partagée, jamais `Math.random()` dans `update()`. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bit d'appartenance PLAYER lu directement sur un collider — même technique que `materialForCollider` dans `weapons.ts`. */
function isPlayerCollider(collider: RAPIER.Collider): boolean {
  const membership = (collider.collisionGroups() >>> 16) & 0xffff;
  return (membership & GROUP.PLAYER) !== 0;
}

/**
 * Ligne de vue dégagée entre deux points, contre la géométrie du niveau
 * SEULE (voir `WORLD_ONLY_RAY_GROUPS`). `ray` est un scratch fourni par
 * l'appelant (zéro allocation). Retourne `true` si RIEN du monde ne bloque
 * le segment `origin -> target`.
 */
function hasClearWorldPath(
  physics: PhysicsWorld,
  origin: THREE.Vector3,
  target: THREE.Vector3,
  ray: RAPIER.Ray,
): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-4) return true;

  ray.origin.x = origin.x;
  ray.origin.y = origin.y;
  ray.origin.z = origin.z;
  ray.dir.x = dx / dist;
  ray.dir.y = dy / dist;
  ray.dir.z = dz / dist;

  // Petite marge sous la distance réelle : évite qu'un contact quasi-tangent
  // pile à la distance cible (imprécision flottante) ne compte comme un
  // blocage alors qu'il n'y a rien entre les deux points.
  //
  // Jalon M3 (PLAN_EFFECT_XSTATE.md) : passe par `RaycastService`, point
  // d'entrée synchrone isolé — pas de restructuration de `update(dt)` en un
  // seul Effect composé (rôle de M6).
  const hit = runGameplaySync(
    RaycastService.use((raycast) =>
      raycast.castRay(
        physics,
        ray,
        Math.max(0, dist - 0.05),
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        WORLD_ONLY_RAY_GROUPS,
      ),
    ),
  );
  return hit === null;
}

export class Suit implements Entity {
  readonly id: number;

  body: RAPIER.RigidBody | null;
  collider: RAPIER.Collider | null;

  /** Centre de la capsule au pas fixe courant. */
  readonly position = new THREE.Vector3();
  readonly previousPosition = new THREE.Vector3();
  /** Orientation horizontale (unitaire, Y=0). `direction = 0` du billboard = vu de face, voir `billboard-sprites-8dir`. */
  readonly forward = new THREE.Vector3(0, 0, 1);
  readonly previousForward = new THREE.Vector3(0, 0, 1);

  state: SuitState = "idle";
  hp: number;

  /** Temps écoulé (secondes de pas fixe) depuis la dernière transition d'état. */
  stateTimer = 0;
  private timeSinceLastSeen = 0;
  private attackCooldownRemaining = 0;
  private isGrounded = false;
  private verticalVelocity = 0;

  private readonly velocityHorizontal = new THREE.Vector3();
  private readonly knockbackVelocity = new THREE.Vector3();

  // --- Sorties lues par `SuitManager` juste après `update()`, puis remises à
  // zéro par CE fichier au tick suivant (jamais par le lecteur) : un Costard
  // ne peut produire qu'UN alerte/UNE télégraphie/UNE attaque par pas fixe,
  // contrairement à `weapons.hitEvents` (plusieurs plombs) — un simple champ
  // suffit, pas de tableau.
  pendingAlert = false;
  pendingTelegraph = false;
  pendingAttackDamage = 0;
  readonly pendingPlayerHitPoint = new THREE.Vector3();
  readonly pendingPlayerHitNormal = new THREE.Vector3();

  private readonly cfg: SuitConfig;
  private readonly nextRandom: () => number;

  // --- Scratch, zéro allocation en régime établi ----------------------------
  private readonly scratchRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
  private readonly scratchToPlayer = new THREE.Vector3();
  private readonly scratchEye = new THREE.Vector3();
  private readonly scratchMoveDir = new THREE.Vector3();
  private readonly scratchLeftDir = new THREE.Vector3();
  private readonly scratchRightDir = new THREE.Vector3();
  private readonly scratchAimDir = new THREE.Vector3();
  private readonly scratchJitteredDir = new THREE.Vector3();
  private readonly scratchAimRight = new THREE.Vector3();
  private readonly scratchAimUp = new THREE.Vector3();
  private readonly desiredScratch = { x: 0, y: 0, z: 0 };
  private readonly movementScratch = { x: 0, y: 0, z: 0 };
  private readonly nextTranslationScratch = new THREE.Vector3();

  /**
   * @param spawnPosition PIEDS du Costard au spawn (x, feetY, z) — même
   *   convention que `PlayerController.spawn(x, feetY, z)`.
   * @param spawnForward Orientation initiale, normalisée en interne (Y ignoré).
   * @param seed Graine PRNG déterministe de cette instance (voir `SuitManager.spawnSuit`, jamais dérivée de `Math.random()`/`Date.now()`).
   */
  constructor(
    physics: PhysicsWorld,
    spawnPosition: THREE.Vector3,
    spawnForward: THREE.Vector3,
    seed: number,
    cfg: SuitConfig = defaultSuitConfig,
  ) {
    this.id = allocateEntityId();
    this.cfg = cfg;
    this.nextRandom = mulberry32(seed);
    this.hp = cfg.maxHp;

    const centerY = spawnPosition.y + cfg.capsuleHalfHeight + cfg.capsuleRadius;
    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawnPosition.x, centerY, spawnPosition.z),
    );
    this.collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(cfg.capsuleHalfHeight, cfg.capsuleRadius).setCollisionGroups(
        COLLISION_GROUPS.ENEMY,
      ),
      this.body,
    );

    this.position.set(spawnPosition.x, centerY, spawnPosition.z);
    this.previousPosition.copy(this.position);
    this.forward.copy(spawnForward);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-8) this.forward.set(0, 0, 1);
    this.forward.normalize();
    this.previousForward.copy(this.forward);
  }

  get isAlive(): boolean {
    return this.state !== "dead" && this.state !== "corpse";
  }

  /** Ligne d'atlas de la pose courante — voir `SUIT_ATLAS_ROWS`. Diagnostic direct : chaque état vivant a sa ligne, la mort en a 4 dédiées. */
  get spriteRow(): number {
    if (this.state === "dead") {
      const frame = Math.min(DEATH_FRAME_COUNT - 1, Math.floor(this.stateTimer / this.cfg.deathFrameDuration));
      return DEATH_ROW_BASE + frame;
    }
    if (this.state === "corpse") return DEATH_ROW_BASE + DEATH_FRAME_COUNT - 1;
    return LIVE_STATE_ROW[this.state];
  }

  /** À appeler avant `stepPhysics`, comme `PlayerController.snapshotPrevious`. */
  snapshotPrevious() {
    this.previousPosition.copy(this.position);
    this.previousForward.copy(this.forward);
  }

  /** Position interpolée pour le rendu. `out` DOIT être passé à `BillboardSprite.updatePose` (jamais une valeur brute du pas fixe). */
  interpolatedPosition(alpha: number, out: THREE.Vector3): THREE.Vector3 {
    return out.lerpVectors(this.previousPosition, this.position, alpha);
  }

  /** Orientation interpolée pour le rendu, toujours renormalisée et non nulle. */
  interpolatedForward(alpha: number, out: THREE.Vector3): THREE.Vector3 {
    out.lerpVectors(this.previousForward, this.forward, alpha);
    if (out.lengthSq() < 1e-8) out.copy(this.forward);
    return out.normalize();
  }

  /**
   * Applique `amount` dégâts. Retourne `{ died }`. Ne touche à AUCUN système
   * de rendu/audio/state — `SuitManager` lit le résultat et construit
   * l'événement approprié (`hurtEvents` ou `deathEvents`).
   *
   * KNOCKBACK : le Costard est kinématique, `RAPIER.RigidBody.applyImpulse`
   * n'aurait aucun effet. `knockbackDirection` (horizontale, normalisée,
   * fournie par l'appelant — généralement Costard -> loin du joueur) est
   * convertie en VÉLOCITÉ interne, décroissante sur `knockbackDecayTime`
   * (voir `updateKnockback`), injectée dans le mouvement désiré du pas fixe
   * suivant exactement comme `PlayerController.velocity`.
   */
  applyDamage(
    amount: number,
    physics: PhysicsWorld,
    knockbackDirection: THREE.Vector3,
  ): { died: boolean } {
    if (!this.isAlive) return { died: false }; // garde-fou : ne devrait jamais arriver, voir `SuitManager`.

    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = "dead";
      this.stateTimer = 0;
      this.velocityHorizontal.set(0, 0, 0);
      this.knockbackVelocity.set(0, 0, 0);
      this.detachPhysics(physics);
      return { died: true };
    }

    this.state = "stagger";
    this.stateTimer = 0;
    this.knockbackVelocity.set(
      knockbackDirection.x * this.cfg.knockbackSpeed,
      this.cfg.knockbackUpBoost,
      knockbackDirection.z * this.cfg.knockbackSpeed,
    );
    return { died: false };
  }

  /** Libère le corps/collider Rapier — appelé une seule fois, à la mort. Le cadavre n'a donc plus de collision ENEMY : il ne bloque plus les tirs ni le joueur. Voir le rapport pour la justification. */
  private detachPhysics(physics: PhysicsWorld) {
    if (this.body) {
      physics.world.removeRigidBody(this.body); // libère aussi le collider attaché (API Rapier).
    }
    this.body = null;
    this.collider = null;
  }

  /**
   * Un pas fixe. `dt` est le dt de GAMEPLAY (scalé par le hitstop, comme
   * `player.update`/`weapons.update`) — jamais d'horloge murale.
   *
   * PRÉCONDITION : `SuitManager` n'appelle PAS `update()` le pas fixe où ce
   * Costard vient d'encaisser un coup — c'est `applyDamage` qui gère ce
   * pas-là (stagger/mort). `update()` suppose donc qu'aucun dégât n'arrive
   * ce tick-ci.
   */
  update(dt: number, ctx: SuitUpdateContext) {
    this.pendingAlert = false;
    this.pendingTelegraph = false;
    this.pendingAttackDamage = 0;

    if (this.state === "corpse") return; // figé, rien à faire (pas d'allocation, pas de raycast).

    if (this.state === "dead") {
      this.stateTimer += dt;
      if (this.stateTimer >= this.cfg.deathFrameDuration * DEATH_FRAME_COUNT) {
        this.state = "corpse";
      }
      return;
    }

    this.updateKnockback(dt);
    this.attackCooldownRemaining = Math.max(0, this.attackCooldownRemaining - dt);

    this.scratchToPlayer.subVectors(ctx.playerTargetPosition, this.position);
    this.scratchToPlayer.y = 0;
    const distance = this.scratchToPlayer.length();
    if (distance > 1e-4) this.scratchToPlayer.multiplyScalar(1 / distance);

    this.velocityHorizontal.set(0, 0, 0);

    switch (this.state) {
      case "idle":
        this.runIdle(ctx, distance);
        break;
      case "alert":
        this.runAlert(dt);
        break;
      case "chase":
        this.runChase(ctx, dt, distance);
        break;
      case "attack":
        this.runAttack(ctx, dt);
        break;
      case "stagger":
        this.runStagger(dt);
        break;
    }

    this.integratePhysics(dt, ctx);
  }

  private runIdle(ctx: SuitUpdateContext, distance: number) {
    if (distance > this.cfg.sightRange) return;
    const eye = this.computeEyePosition(this.scratchEye);
    if (!hasClearWorldPath(ctx.physics, eye, ctx.playerEyePosition, this.scratchRay)) return;

    this.state = "alert";
    this.stateTimer = 0;
    this.timeSinceLastSeen = 0;
    this.pendingAlert = true;
  }

  private runAlert(dt: number) {
    this.stateTimer += dt;
    this.turnTowards(this.scratchToPlayer, dt);
    // Transition INCONDITIONNELLE après `alertDuration` : ne re-checke pas la
    // ligne de vue ici (délibéré — un état aussi court qui clignoterait entre
    // ALERTE et IDLE serait précisément le genre d'état "confus" que le
    // skill `enemy-state-machine` proscrit). `chase` reprend le suivi normal
    // de `timeSinceLastSeen` dès la transition.
    if (this.stateTimer >= this.cfg.alertDuration) {
      this.state = "chase";
      this.stateTimer = 0;
    }
  }

  private runChase(ctx: SuitUpdateContext, dt: number, distance: number) {
    const eye = this.computeEyePosition(this.scratchEye);
    const inSight = distance <= this.cfg.sightRange && hasClearWorldPath(ctx.physics, eye, ctx.playerEyePosition, this.scratchRay);

    if (inSight) this.timeSinceLastSeen = 0;
    else this.timeSinceLastSeen += dt;

    if (this.timeSinceLastSeen >= this.cfg.lostContactTimeout) {
      this.state = "idle";
      this.stateTimer = 0;
      return;
    }

    if (inSight && distance <= this.cfg.attackRange && this.attackCooldownRemaining <= 0) {
      this.state = "attack";
      this.stateTimer = 0;
      this.pendingTelegraph = true;
      this.turnTowards(this.scratchToPlayer, dt);
      return;
    }

    const avoided = this.computeAvoidedDirection(ctx.physics, this.scratchToPlayer, this.scratchMoveDir);
    this.velocityHorizontal.copy(avoided).multiplyScalar(this.cfg.chaseSpeed);
    this.turnTowards(this.scratchToPlayer.lengthSq() > 1e-8 ? this.scratchToPlayer : avoided, dt);
  }

  private runAttack(ctx: SuitUpdateContext, dt: number) {
    this.turnTowards(this.scratchToPlayer, dt);
    this.stateTimer += dt;
    if (this.stateTimer < this.cfg.attackTelegraphDuration) return; // pose TIR tenue = la télégraphie visuelle exigée par le skill.

    this.resolveAttack(ctx);
    this.state = "chase";
    this.stateTimer = 0;
    this.attackCooldownRemaining = this.cfg.attackCooldown;
    this.timeSinceLastSeen = 0;
  }

  private runStagger(dt: number) {
    this.stateTimer += dt;
    if (this.stateTimer >= this.cfg.staggerDuration) {
      this.state = "chase";
      this.stateTimer = 0;
      this.timeSinceLastSeen = 0; // encaisser un coup révèle forcément la position du joueur.
    }
  }

  /**
   * Raycast d'attaque (groupe `ENEMY_SHOT`, cf. `physics/world.ts` —
   * interagit avec WORLD + PLAYER, jamais un autre Costard). Re-vérifie la
   * ligne de vue au moment du tir : le joueur a pu se mettre à couvert
   * pendant la fenêtre de télégraphie. Dans ce cas l'attaque rate
   * SILENCIEUSEMENT (pas de second son/flash de "raté" — c'est la fenêtre
   * d'esquive volontaire du joueur, une pénalité sonore supplémentaire n'y
   * ajouterait rien).
   */
  private resolveAttack(ctx: SuitUpdateContext) {
    const eye = this.computeEyePosition(this.scratchEye);
    const targetEye = ctx.playerEyePosition;

    if (!hasClearWorldPath(ctx.physics, eye, targetEye, this.scratchRay)) return;

    this.scratchAimDir.subVectors(targetEye, eye).normalize();
    this.applyAimJitter(this.scratchAimDir, this.scratchJitteredDir);

    const maxDist = eye.distanceTo(targetEye) + 4; // marge : ce qui compte est le PREMIER collider touché.

    this.scratchRay.origin.x = eye.x;
    this.scratchRay.origin.y = eye.y;
    this.scratchRay.origin.z = eye.z;
    this.scratchRay.dir.x = this.scratchJitteredDir.x;
    this.scratchRay.dir.y = this.scratchJitteredDir.y;
    this.scratchRay.dir.z = this.scratchJitteredDir.z;

    // Jalon M3 (PLAN_EFFECT_XSTATE.md) : passe par `RaycastService`.
    const hit = runGameplaySync(
      RaycastService.use((raycast) =>
        raycast.castRayAndGetNormal(
          ctx.physics,
          this.scratchRay,
          maxDist,
          true,
          RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
          COLLISION_GROUPS.ENEMY_SHOT,
        ),
      ),
    );
    if (!hit || !isPlayerCollider(hit.collider)) return; // mur touché en premier (jitter, ou joueur sorti du couloir de tir) : raté silencieux.

    this.pendingAttackDamage = this.cfg.attackDamage;
    this.pendingPlayerHitPoint.set(
      eye.x + this.scratchJitteredDir.x * hit.timeOfImpact,
      eye.y + this.scratchJitteredDir.y * hit.timeOfImpact,
      eye.z + this.scratchJitteredDir.z * hit.timeOfImpact,
    );
    this.pendingPlayerHitNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);
  }

  /** Petite déviation angulaire de `dir`, PRNG seedé par entité (jamais `Math.random()`). */
  private applyAimJitter(dir: THREE.Vector3, out: THREE.Vector3) {
    const jitterYaw = (this.nextRandom() * 2 - 1) * THREE.MathUtils.degToRad(this.cfg.aimJitterDeg);
    const jitterPitch = (this.nextRandom() * 2 - 1) * THREE.MathUtils.degToRad(this.cfg.aimJitterDeg);

    const upHint = Math.abs(dir.y) > 0.98 ? WORLD_RIGHT_FALLBACK : WORLD_UP;
    this.scratchAimRight.crossVectors(upHint, dir).normalize();
    this.scratchAimUp.crossVectors(dir, this.scratchAimRight).normalize();

    out
      .copy(dir)
      .addScaledVector(this.scratchAimRight, Math.tan(jitterYaw))
      .addScaledVector(this.scratchAimUp, Math.tan(jitterPitch))
      .normalize();
  }

  /** Décroissance linéaire de la vélocité de recul — même idiome que `approach()` de `controller.ts`, non importé pour garder `Suit` indépendant du module joueur. */
  private updateKnockback(dt: number) {
    const speed = this.knockbackVelocity.length();
    if (speed <= 1e-4) {
      this.knockbackVelocity.set(0, 0, 0);
      return;
    }
    const drop = (speed / this.cfg.knockbackDecayTime) * dt;
    const newSpeed = Math.max(0, speed - drop);
    this.knockbackVelocity.multiplyScalar(newSpeed / speed);
  }

  /**
   * 3 rayons d'évitement (avant, avant-gauche 30°, avant-droit 30°) contre la
   * géométrie du niveau SEULE — exactement le contrat du skill
   * `enemy-state-machine`. Pas de navmesh : si les trois sont bloqués, le
   * Costard reste sur place ce pas-ci (« un ennemi coincé derrière une
   * gondole est acceptable »).
   */
  private computeAvoidedDirection(
    physics: PhysicsWorld,
    desiredDir: THREE.Vector3,
    out: THREE.Vector3,
  ): THREE.Vector3 {
    if (desiredDir.lengthSq() < 1e-8) return out.set(0, 0, 0);

    if (this.castAvoidanceRay(physics, desiredDir)) return out.copy(desiredDir);

    const angleRad = THREE.MathUtils.degToRad(this.cfg.avoidanceSideAngleDeg);
    this.rotateHorizontal(desiredDir, angleRad, this.scratchLeftDir);
    this.rotateHorizontal(desiredDir, -angleRad, this.scratchRightDir);

    if (this.castAvoidanceRay(physics, this.scratchLeftDir)) return out.copy(this.scratchLeftDir);
    if (this.castAvoidanceRay(physics, this.scratchRightDir)) return out.copy(this.scratchRightDir);

    return out.set(0, 0, 0);
  }

  private castAvoidanceRay(physics: PhysicsWorld, dir: THREE.Vector3): boolean {
    this.scratchRay.origin.x = this.position.x;
    this.scratchRay.origin.y = this.position.y;
    this.scratchRay.origin.z = this.position.z;
    this.scratchRay.dir.x = dir.x;
    this.scratchRay.dir.y = 0;
    this.scratchRay.dir.z = dir.z;
    // Jalon M3 (PLAN_EFFECT_XSTATE.md) : passe par `RaycastService`.
    const hit = runGameplaySync(
      RaycastService.use((raycast) =>
        raycast.castRay(
          physics,
          this.scratchRay,
          this.cfg.avoidanceRayLength,
          true,
          RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
          WORLD_ONLY_RAY_GROUPS,
        ),
      ),
    );
    return hit === null;
  }

  private rotateHorizontal(dir: THREE.Vector3, angleRad: number, out: THREE.Vector3): THREE.Vector3 {
    const c = Math.cos(angleRad);
    const s = Math.sin(angleRad);
    return out.set(dir.x * c + dir.z * s, 0, -dir.x * s + dir.z * c);
  }

  /** Tourne `forward` vers `targetDir` à vitesse angulaire bornée (`turnRateRadPerSec`) — évite un flip instantané de sprite quand l'évitement change de côté d'un pas fixe à l'autre. */
  private turnTowards(targetDir: THREE.Vector3, dt: number) {
    if (targetDir.lengthSq() < 1e-8) return;
    const currentAngle = Math.atan2(this.forward.x, this.forward.z);
    const targetAngle = Math.atan2(targetDir.x, targetDir.z);
    let delta = targetAngle - currentAngle;
    delta = ((delta + Math.PI) % TAU + TAU) % TAU - Math.PI; // repli dans [-PI, PI]
    const maxStep = this.cfg.turnRateRadPerSec * dt;
    const applied = Math.abs(delta) <= maxStep ? delta : Math.sign(delta) * maxStep;
    const newAngle = currentAngle + applied;
    this.forward.set(Math.sin(newAngle), 0, Math.cos(newAngle));
  }

  private computeEyePosition(out: THREE.Vector3): THREE.Vector3 {
    const feetY = this.position.y - (this.cfg.capsuleHalfHeight + this.cfg.capsuleRadius);
    return out.set(this.position.x, feetY + this.cfg.eyeHeight, this.position.z);
  }

  /**
   * Gravité + collage au sol + recul, intégrés et résolus par le
   * `KinematicCharacterController` PARTAGÉ (`ctx.kcc`) — même schéma que
   * `PlayerController.update`, sans le saut ni le reclip anti-mur (skill :
   * simplicité prime, « un ennemi coincé est acceptable »).
   */
  private integratePhysics(dt: number, ctx: SuitUpdateContext) {
    if (!this.body || !this.collider) return; // garde-fou (ne devrait jamais arriver : dead/corpse retournent avant).

    const gravityY = ctx.physics.gravityY;
    this.verticalVelocity += gravityY * dt;
    if (this.isGrounded && this.verticalVelocity < 0) this.verticalVelocity = -this.cfg.groundStickSpeed;
    if (this.verticalVelocity < -this.cfg.maxFallSpeed) this.verticalVelocity = -this.cfg.maxFallSpeed;

    this.desiredScratch.x = (this.velocityHorizontal.x + this.knockbackVelocity.x) * dt;
    this.desiredScratch.y = (this.verticalVelocity + this.knockbackVelocity.y) * dt;
    this.desiredScratch.z = (this.velocityHorizontal.z + this.knockbackVelocity.z) * dt;

    const collider = this.collider;
    ctx.kcc.computeColliderMovement(
      collider,
      this.desiredScratch,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      COLLISION_GROUPS.ENEMY,
      (other) => other.handle !== collider.handle,
    );
    ctx.kcc.computedMovement(this.movementScratch);
    const grounded = ctx.kcc.computedGrounded();
    if (grounded && this.verticalVelocity < 0) this.verticalVelocity = 0;
    this.isGrounded = grounded;

    const current = this.body.translation();
    this.nextTranslationScratch.set(
      current.x + this.movementScratch.x,
      current.y + this.movementScratch.y,
      current.z + this.movementScratch.z,
    );
    this.body.setNextKinematicTranslation(this.nextTranslationScratch);
    this.position.copy(this.nextTranslationScratch);
  }
}

/**
 * Applique la configuration `SuitConfig` à un `KinematicCharacterController`
 * brut (`physics.world.createCharacterController(offset)`, API Rapier,
 * PAS `PhysicsWorld.createCharacterController(cfg: MoveConfig)` — cette
 * dernière est typée pour le joueur et n'a pas de sens ici). Liste d'appels
 * calquée sur `configureCharacterController` de `physics/world.ts`, sans en
 * réutiliser la signature.
 */
export function configureSuitCharacterController(controller: RAPIER.KinematicCharacterController, cfg: SuitConfig) {
  controller.setUp({ x: 0, y: 1, z: 0 });
  controller.setOffset(cfg.colliderOffset);
  controller.setSlideEnabled(true);
  controller.enableAutostep(cfg.autostepMaxHeight, cfg.autostepMinWidth, cfg.autostepIncludeDynamicBodies);
  controller.enableSnapToGround(cfg.snapToGroundDistance);
  controller.setMaxSlopeClimbAngle((cfg.maxSlopeClimbAngleDeg * Math.PI) / 180);
  controller.setMinSlopeSlideAngle((cfg.minSlopeSlideAngleDeg * Math.PI) / 180);
  controller.setApplyImpulsesToDynamicBodies(true);
  controller.setCharacterMass(cfg.characterMass);
}
