import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Effect } from "effect";
import { type Actor, createActor, setup } from "xstate";

import { DeterministicRandom } from "../../core/random";
import { runGameplaySync } from "../../core/runtime";
import { RaycastService } from "../../physics/raycast";
import { COLLISION_GROUPS, GROUP, interactionGroups, type PhysicsWorld } from "../../physics/world";
import { PathfindingService, type NavGraph } from "../level/pathfinding";
import { cheats } from "../devtools/cheats";
import type { EnemyAnimationInput } from "../../render/enemySprites";

/**
 * Machine à états PARTAGÉE entre `Suit` et `Director` — voir
 * docs/decisions/0009-machine-partagee-suit-director.md pour la décision.
 * Tout ce qui est indépendant du gabarit visuel/Rapier exact de l'entité vit
 * ici (table de transition, durées, perception, évitement local, suivi de
 * chemin, jitter de visée, knockback, intégration physique) ; `suit.ts`/
 * `director.ts` ne gardent que le corps/collider Rapier, leur config et
 * leur acteur XState.
 *
 * Plusieurs choix internes non évidents (pourquoi `attackCooldownRemaining`/
 * `timeSinceLastSeen` ne sont pas des `stateTimer`, pourquoi pas de `guard:`
 * pour les transitions pilotées par TICK, comment `state`/`stateTimer`
 * restent réaffectables depuis les tests, la discipline zéro-allocation, et
 * pourquoi `after` — transitions retardées par temps mural — est interdit
 * ici) sont documentés en détail :
 * see: docs/systems/entites.md#la-machine-partagée-ce-quelle-porte-et-où-sarrête-sa-responsabilité
 *
 * Rappel le plus susceptible d'être violé par erreur en éditant ce fichier :
 * toute action MUTE `context` directement (`context.stateTimer = 0`), ne
 * jamais utiliser `assign(...)` (réallouerait `context` à chaque
 * transition) ; aucune durée d'état ne doit passer par `after`/`setTimeout`
 * (invariant #13 de CLAUDE.md) — seul `context.stateTimer`, incrémenté par
 * `tickEnemy` avec le `dt` de gameplay, mesure le temps.
 */

const TAU = Math.PI * 2;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_RIGHT_FALLBACK = new THREE.Vector3(1, 0, 0);

/** Distance dont la cible doit avoir bougé avant qu'un nouveau chemin soit requêté (jalon M4). */
const PATH_REQUERY_DISTANCE = 1.5;
/** Distance en dessous de laquelle un waypoint du chemin baké est considéré atteint. */
const WAYPOINT_REACHED_DISTANCE = 0.6;

/** Filtre « rayon d'ENEMY qui ne teste QUE la géométrie du niveau » — membership ENEMY, filtre WORLD SEUL : ne peut jamais toucher le joueur ni un autre ennemi. */
const WORLD_ONLY_RAY_GROUPS = interactionGroups(GROUP.ENEMY, GROUP.WORLD);

function horizontalDistanceSq(a: THREE.Vector3, b: THREE.Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

// Config — sous-ensemble structurel commun à `SuitConfig`/`DirectorConfig`.

/**
 * Champs de config lus par la logique PARTAGÉE ci-dessous. `SuitConfig`/
 * `DirectorConfig` restent des interfaces DISTINCTES (objets de tuning
 * séparés, valeurs différentes par type d'ennemi — voir leur propre
 * fichier) ; elles satisfont toutes deux `EnemyConfig` STRUCTURELLEMENT
 * (mêmes noms de champs, TypeScript ne demande rien de plus), donc
 * `this.cfg` (typé `SuitConfig`/`DirectorConfig` côté wrapper) se passe tel
 * quel aux fonctions partagées sans conversion.
 */
export interface EnemyConfig {
  capsuleRadius: number;
  capsuleHalfHeight: number;
  eyeHeight: number;
  characterMass: number;
  colliderOffset: number;
  autostepMaxHeight: number;
  autostepMinWidth: number;
  autostepIncludeDynamicBodies: boolean;
  snapToGroundDistance: number;
  maxSlopeClimbAngleDeg: number;
  minSlopeSlideAngleDeg: number;
  groundStickSpeed: number;
  maxFallSpeed: number;

  sightRange: number;
  lostContactTimeout: number;

  chaseSpeed: number;
  turnRateRadPerSec: number;

  avoidanceRayLength: number;
  avoidanceSideAngleDeg: number;

  alertDuration: number;
  attackTelegraphDuration: number;
  attackCooldown: number;
  attackRange: number;
  staggerDuration: number;
  deathFrameDuration: number;

  attackDamage: number;
  aimJitterDeg: number;

  knockbackSpeed: number;
  knockbackDecayTime: number;
  knockbackUpBoost: number;
}

// États — partagés (identiques entre Suit et Director).

export type EnemyLiveState = "idle" | "alert" | "chase" | "attack" | "stagger";
export type EnemyState = EnemyLiveState | "dead" | "corpse";

/** Pose du sprite pour chaque état : l'attaque se TIENT en joue pendant la télégraphie. */
const ENEMY_POSE: Record<EnemyState, EnemyAnimationInput["pose"]> = {
  idle: "idle",
  alert: "alert",
  chase: "chase",
  attack: "aim",
  stagger: "stagger",
  dead: "death",
  corpse: "corpse",
};

/**
 * Traduit l'état courant en entrées d'animation du sprite, écrites dans `out`
 * (zéro allocation par frame). Lecture seule : l'animation ne décide rien.
 * see: docs/systems/rendu.md#animation-des-sprites-dennemis
 */
export function readEnemyAnimation(actor: EnemyActor, out: EnemyAnimationInput): EnemyAnimationInput {
  const snapshot = actor.getSnapshot();
  const ctx = snapshot.context;
  const state = snapshot.value as EnemyState;
  out.pose = ENEMY_POSE[state];
  out.poseTime = ctx.stateTimer;
  out.poseDuration =
    state === "alert"
      ? ctx.cfg.alertDuration
      : state === "stagger"
        ? ctx.cfg.staggerDuration
        : state === "dead"
          ? ctx.cfg.deathFrameDuration * ctx.deathFrameCount
          : 0;
  out.clock = ctx.animClock;
  out.stride = ctx.strideDistance;
  out.timeSinceShot = ctx.timeSinceShot;
  return out;
}

// Contexte per-tick fourni par l'appelant (SuitManager/DirectorManager) —
// remplace `SuitUpdateContext`/`DirectorUpdateContext` (ré-exportés en alias
// de type depuis `suit.ts`/`director.ts` pour ne rien casser côté appelants).

export interface EnemyUpdateContext {
  physics: PhysicsWorld;
  /** Contrôleur PARTAGÉ — une seule instance, possédée par `SuitManager`/`DirectorManager`. */
  kcc: RAPIER.KinematicCharacterController;
  playerTargetPosition: THREE.Vector3;
  playerEyePosition: THREE.Vector3;
  navGraph: NavGraph | null;
}

// Contexte XState — TOUT ce qu'une entité porte, hors id/rendu/`revealed`.

export interface EnemyMachineContext {
  readonly cfg: EnemyConfig;
  readonly nextRandom: () => number;

  body: RAPIER.RigidBody | null;
  collider: RAPIER.Collider | null;

  readonly position: THREE.Vector3;
  readonly previousPosition: THREE.Vector3;
  readonly forward: THREE.Vector3;
  readonly previousForward: THREE.Vector3;

  hp: number;
  stateTimer: number;
  /** PAS un `stateTimer` : persiste à travers toutes les transitions, remis à zéro par des règles précises. */
  // see: docs/systems/entites.md#deux-catégories-de-données-dans-le-contexte-minuteurs-détat-et-mémoire-persistante
  timeSinceLastSeen: number;
  /** Idem. */
  attackCooldownRemaining: number;
  isGrounded: boolean;
  verticalVelocity: number;

  readonly velocityHorizontal: THREE.Vector3;
  readonly knockbackVelocity: THREE.Vector3;

  pendingAlert: boolean;
  pendingTelegraph: boolean;
  pendingAttackDamage: number;
  readonly pendingPlayerHitPoint: THREE.Vector3;
  readonly pendingPlayerHitNormal: THREE.Vector3;

  currentPath: ReadonlyArray<THREE.Vector3>;
  currentWaypointIndex: number;
  readonly lastPathQueryTarget: THREE.Vector3;

  /** Nombre de frames de l'animation de mort — `DEATH_FRAME_COUNT`/`DIRECTOR_DEATH_FRAME_COUNT`, fourni par le wrapper à la construction plutôt que codé en dur ici. */
  readonly deathFrameCount: number;

  // --- Horloges d'animation du sprite, avancées au pas fixe et lues par le
  // rendu seul (`readEnemyAnimation`) : aucune décision ne les consulte.
  /** Secondes de gameplay depuis l'apparition. */
  animClock: number;
  /** Mètres parcourus depuis l'apparition : font défiler la course. */
  strideDistance: number;
  /** Secondes depuis le dernier tir réellement parti. */
  timeSinceShot: number;

  // --- Scratch, zéro allocation en régime établi (identique à l'avant-jalon).
  readonly scratchRay: RAPIER.Ray;
  readonly scratchToPlayer: THREE.Vector3;
  readonly scratchEye: THREE.Vector3;
  readonly scratchMoveDir: THREE.Vector3;
  readonly scratchLeftDir: THREE.Vector3;
  readonly scratchRightDir: THREE.Vector3;
  readonly scratchAimDir: THREE.Vector3;
  readonly scratchJitteredDir: THREE.Vector3;
  readonly scratchAimRight: THREE.Vector3;
  readonly scratchAimUp: THREE.Vector3;
  readonly desiredScratch: { x: number; y: number; z: number };
  readonly movementScratch: { x: number; y: number; z: number };
  readonly nextTranslationScratch: THREE.Vector3;
}

export interface CreateEnemyContextParams {
  cfg: EnemyConfig;
  nextRandom: () => number;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  /** Centre de la capsule au spawn (PAS les pieds — voir `createEnemyBody`). */
  centerPosition: THREE.Vector3;
  /** Orientation initiale, DÉJÀ normalisée (Y=0) — voir le constructeur de `Suit`/`Director`. */
  forward: THREE.Vector3;
  hp: number;
  deathFrameCount: number;
}

/** Construit le `context` XState d'une entité neuve. Appelé UNE FOIS par le constructeur de `Suit`/`Director`, jamais par pas fixe. */
export function createEnemyMachineContext(params: CreateEnemyContextParams): EnemyMachineContext {
  const position = params.centerPosition.clone();
  const forward = params.forward.clone();
  return {
    cfg: params.cfg,
    nextRandom: params.nextRandom,

    body: params.body,
    collider: params.collider,

    position,
    previousPosition: position.clone(),
    forward,
    previousForward: forward.clone(),

    hp: params.hp,
    stateTimer: 0,
    timeSinceLastSeen: 0,
    attackCooldownRemaining: 0,
    isGrounded: false,
    verticalVelocity: 0,

    velocityHorizontal: new THREE.Vector3(),
    knockbackVelocity: new THREE.Vector3(),

    pendingAlert: false,
    pendingTelegraph: false,
    pendingAttackDamage: 0,
    pendingPlayerHitPoint: new THREE.Vector3(),
    pendingPlayerHitNormal: new THREE.Vector3(),

    currentPath: [],
    currentWaypointIndex: 0,
    // Sentinelle loin de tout niveau réel — garantit une première requête de
    // chemin dès le premier pas fixe en `chase`.
    lastPathQueryTarget: new THREE.Vector3(Number.POSITIVE_INFINITY, 0, Number.POSITIVE_INFINITY),

    deathFrameCount: params.deathFrameCount,

    animClock: 0,
    strideDistance: 0,
    timeSinceShot: Number.POSITIVE_INFINITY,

    scratchRay: new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }),
    scratchToPlayer: new THREE.Vector3(),
    scratchEye: new THREE.Vector3(),
    scratchMoveDir: new THREE.Vector3(),
    scratchLeftDir: new THREE.Vector3(),
    scratchRightDir: new THREE.Vector3(),
    scratchAimDir: new THREE.Vector3(),
    scratchJitteredDir: new THREE.Vector3(),
    scratchAimRight: new THREE.Vector3(),
    scratchAimUp: new THREE.Vector3(),
    desiredScratch: { x: 0, y: 0, z: 0 },
    movementScratch: { x: 0, y: 0, z: 0 },
    nextTranslationScratch: new THREE.Vector3(),
  };
}

/**
 * PRNG déterministe — une instance PAR ENTITÉ, jamais partagée, jamais
 * `Math.random()`. Générateur obtenu via `DeterministicRandom`
 * (`core/random.ts`, invariant #12 de `CLAUDE.md`) — plus de copie locale
 * de mulberry32 ici depuis le nettoyage du 2026-09-05 (même source
 * canonique que `weapons.ts`).
 */
export function createEnemyPrng(seed: number): () => number {
  return runGameplaySync(DeterministicRandom.useSync((random) => random.forSeed(seed)));
}

/** Bit d'appartenance PLAYER lu directement sur un collider — même technique que `weapons.ts`. */
function isPlayerCollider(collider: RAPIER.Collider): boolean {
  const membership = (collider.collisionGroups() >>> 16) & 0xffff;
  return (membership & GROUP.PLAYER) !== 0;
}

/**
 * Construit le corps kinématique + le collider capsule d'une entité —
 * IDENTIQUE entre `Suit`/`Director` avant ce jalon (seuls les nombres de
 * `cfg` changent). `spawnPosition` = PIEDS (même convention que
 * `PlayerController.spawn`) ; retourne aussi `centerY` (déjà calculé) pour
 * éviter à l'appelant de le recalculer.
 */
export function createEnemyBody(
  physics: PhysicsWorld,
  cfg: EnemyConfig,
  spawnPosition: THREE.Vector3,
): { body: RAPIER.RigidBody; collider: RAPIER.Collider; centerY: number } {
  const centerY = spawnPosition.y + cfg.capsuleHalfHeight + cfg.capsuleRadius;
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawnPosition.x, centerY, spawnPosition.z),
  );
  const collider = physics.world.createCollider(
    RAPIER.ColliderDesc.capsule(cfg.capsuleHalfHeight, cfg.capsuleRadius).setCollisionGroups(COLLISION_GROUPS.ENEMY),
    body,
  );
  return { body, collider, centerY };
}

/**
 * Configure un `KinematicCharacterController` brut pour une entité —
 * IDENTIQUE entre `configureSuitCharacterController`/
 * `configureDirectorCharacterController` avant ce jalon ; ces deux noms
 * restent exportés par `suit.ts`/`director.ts` (appelants inchangés :
 * `SuitManager`/`DirectorManager`), en simples re-exports de celle-ci.
 */
export function configureEnemyCharacterController(
  controller: RAPIER.KinematicCharacterController,
  cfg: EnemyConfig,
): void {
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

function detachEnemyPhysics(ctx: EnemyMachineContext, physics: PhysicsWorld): void {
  if (ctx.body) {
    physics.world.removeRigidBody(ctx.body); // libère aussi le collider attaché (API Rapier).
  }
  ctx.body = null;
  ctx.collider = null;
}

function computeEyePosition(ctx: EnemyMachineContext, out: THREE.Vector3): THREE.Vector3 {
  const feetY = ctx.position.y - (ctx.cfg.capsuleHalfHeight + ctx.cfg.capsuleRadius);
  return out.set(ctx.position.x, feetY + ctx.cfg.eyeHeight, ctx.position.z);
}

/**
 * Ligne de vue dégagée entre deux points, contre la géométrie du niveau
 * SEULE. `ray` est un scratch fourni par l'appelant (zéro allocation).
 * Retourne `true` si RIEN du monde ne bloque le segment `origin -> target`.
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

function updateKnockback(ctx: EnemyMachineContext, dt: number): void {
  const speed = ctx.knockbackVelocity.length();
  if (speed <= 1e-4) {
    ctx.knockbackVelocity.set(0, 0, 0);
    return;
  }
  const drop = (speed / ctx.cfg.knockbackDecayTime) * dt;
  const newSpeed = Math.max(0, speed - drop);
  ctx.knockbackVelocity.multiplyScalar(newSpeed / speed);
}

function rotateHorizontal(dir: THREE.Vector3, angleRad: number, out: THREE.Vector3): THREE.Vector3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return out.set(dir.x * c + dir.z * s, 0, -dir.x * s + dir.z * c);
}

function castAvoidanceRay(ctx: EnemyMachineContext, physics: PhysicsWorld, dir: THREE.Vector3): boolean {
  ctx.scratchRay.origin.x = ctx.position.x;
  ctx.scratchRay.origin.y = ctx.position.y;
  ctx.scratchRay.origin.z = ctx.position.z;
  ctx.scratchRay.dir.x = dir.x;
  ctx.scratchRay.dir.y = 0;
  ctx.scratchRay.dir.z = dir.z;
  const hit = runGameplaySync(
    RaycastService.use((raycast) =>
      raycast.castRay(
        physics,
        ctx.scratchRay,
        ctx.cfg.avoidanceRayLength,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        WORLD_ONLY_RAY_GROUPS,
      ),
    ),
  );
  return hit === null;
}

/**
 * 3 rayons d'évitement (avant, avant-gauche 30°, avant-droit 30°) contre la
 * géométrie du niveau SEULE — contrat du skill `enemy-state-machine`. ORDRE
 * DE TEST LITTÉRAL préservé (avant -> gauche -> droite), un test de
 * caractérisation le vérifie explicitement. Pas de navmesh : si les trois
 * sont bloqués, l'entité reste sur place ce pas-ci.
 */
function computeAvoidedDirection(
  ctx: EnemyMachineContext,
  physics: PhysicsWorld,
  desiredDir: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 {
  if (desiredDir.lengthSq() < 1e-8) return out.set(0, 0, 0);

  if (castAvoidanceRay(ctx, physics, desiredDir)) return out.copy(desiredDir);

  const angleRad = THREE.MathUtils.degToRad(ctx.cfg.avoidanceSideAngleDeg);
  rotateHorizontal(desiredDir, angleRad, ctx.scratchLeftDir);
  rotateHorizontal(desiredDir, -angleRad, ctx.scratchRightDir);

  if (castAvoidanceRay(ctx, physics, ctx.scratchLeftDir)) return out.copy(ctx.scratchLeftDir);
  if (castAvoidanceRay(ctx, physics, ctx.scratchRightDir)) return out.copy(ctx.scratchRightDir);

  return out.set(0, 0, 0);
}

/** Tourne `forward` vers `targetDir` à vitesse angulaire bornée (`turnRateRadPerSec`). */
function turnTowards(ctx: EnemyMachineContext, targetDir: THREE.Vector3, dt: number): void {
  if (targetDir.lengthSq() < 1e-8) return;
  const currentAngle = Math.atan2(ctx.forward.x, ctx.forward.z);
  const targetAngle = Math.atan2(targetDir.x, targetDir.z);
  let delta = targetAngle - currentAngle;
  delta = ((delta + Math.PI) % TAU + TAU) % TAU - Math.PI; // repli dans [-PI, PI]
  const maxStep = ctx.cfg.turnRateRadPerSec * dt;
  const applied = Math.abs(delta) <= maxStep ? delta : Math.sign(delta) * maxStep;
  const newAngle = currentAngle + applied;
  ctx.forward.set(Math.sin(newAngle), 0, Math.cos(newAngle));
}

/**
 * Direction horizontale (X/Z, Y=0) vers le prochain waypoint du chemin baké
 * courant, écrite dans `out`. Retourne `false` (n'écrit RIEN dans `out`) si
 * aucun pathfinding exploitable n'est disponible ce pas-ci — `runChase`
 * retombe alors sur `computeAvoidedDirection`, INCHANGÉ (filet de sécurité
 * explicite, jalon M4).
 */
function tryComputeChaseDirectionFromPath(
  ctx: EnemyMachineContext,
  updateCtx: EnemyUpdateContext,
  out: THREE.Vector3,
): boolean {
  const navGraph = updateCtx.navGraph;
  if (!navGraph) return false;

  const target = updateCtx.playerTargetPosition;
  const pathExhausted = ctx.currentWaypointIndex >= ctx.currentPath.length;
  const targetMovedEnough =
    ctx.lastPathQueryTarget.distanceToSquared(target) >= PATH_REQUERY_DISTANCE * PATH_REQUERY_DISTANCE;

  if (pathExhausted || targetMovedEnough) {
    ctx.lastPathQueryTarget.copy(target);
    const fromPosition = ctx.position;
    const path = runGameplaySync(
      PathfindingService.use((pf) => pf.findPath(navGraph, fromPosition, target)).pipe(
        Effect.catch(() => Effect.succeed(null)),
      ),
    );
    ctx.currentPath = path ?? [];
    ctx.currentWaypointIndex = 0;
  }

  if (ctx.currentWaypointIndex >= ctx.currentPath.length) return false; // aucun chemin exploitable — repli.

  while (
    ctx.currentWaypointIndex < ctx.currentPath.length - 1 &&
    horizontalDistanceSq(ctx.position, ctx.currentPath[ctx.currentWaypointIndex]!) <
      WAYPOINT_REACHED_DISTANCE * WAYPOINT_REACHED_DISTANCE
  ) {
    ctx.currentWaypointIndex++;
  }

  const waypoint = ctx.currentPath[ctx.currentWaypointIndex]!;
  out.set(waypoint.x - ctx.position.x, 0, waypoint.z - ctx.position.z);
  if (out.lengthSq() < 1e-8) return true; // déjà sur le waypoint : pathfinding "actif" mais rien à déplacer ce pas-ci.
  out.normalize();
  return true;
}

/** Petite déviation angulaire de `dir`, PRNG seedé par entité (jamais `Math.random()`). */
function applyAimJitter(ctx: EnemyMachineContext, dir: THREE.Vector3, out: THREE.Vector3): void {
  const jitterYaw = (ctx.nextRandom() * 2 - 1) * THREE.MathUtils.degToRad(ctx.cfg.aimJitterDeg);
  const jitterPitch = (ctx.nextRandom() * 2 - 1) * THREE.MathUtils.degToRad(ctx.cfg.aimJitterDeg);

  const upHint = Math.abs(dir.y) > 0.98 ? WORLD_RIGHT_FALLBACK : WORLD_UP;
  ctx.scratchAimRight.crossVectors(upHint, dir).normalize();
  ctx.scratchAimUp.crossVectors(dir, ctx.scratchAimRight).normalize();

  out
    .copy(dir)
    .addScaledVector(ctx.scratchAimRight, Math.tan(jitterYaw))
    .addScaledVector(ctx.scratchAimUp, Math.tan(jitterPitch))
    .normalize();
}

/**
 * Raycast d'attaque (groupe `ENEMY_SHOT`). Re-vérifie la ligne de vue au
 * moment du tir : le joueur a pu se mettre à couvert pendant la fenêtre de
 * télégraphie — l'attaque rate alors SILENCIEUSEMENT.
 */
function resolveAttack(ctx: EnemyMachineContext, updateCtx: EnemyUpdateContext): void {
  if (cheats.notarget) return; // dev : la pose de tir va au bout, le coup ne part pas
  const eye = computeEyePosition(ctx, ctx.scratchEye);
  const targetEye = updateCtx.playerEyePosition;

  if (!hasClearWorldPath(updateCtx.physics, eye, targetEye, ctx.scratchRay)) return;

  ctx.timeSinceShot = 0; // le coup part, touché ou non.
  ctx.scratchAimDir.subVectors(targetEye, eye).normalize();
  applyAimJitter(ctx, ctx.scratchAimDir, ctx.scratchJitteredDir);

  const maxDist = eye.distanceTo(targetEye) + 4; // marge : ce qui compte est le PREMIER collider touché.

  ctx.scratchRay.origin.x = eye.x;
  ctx.scratchRay.origin.y = eye.y;
  ctx.scratchRay.origin.z = eye.z;
  ctx.scratchRay.dir.x = ctx.scratchJitteredDir.x;
  ctx.scratchRay.dir.y = ctx.scratchJitteredDir.y;
  ctx.scratchRay.dir.z = ctx.scratchJitteredDir.z;

  const hit = runGameplaySync(
    RaycastService.use((raycast) =>
      raycast.castRayAndGetNormal(
        updateCtx.physics,
        ctx.scratchRay,
        maxDist,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        COLLISION_GROUPS.ENEMY_SHOT,
      ),
    ),
  );
  if (!hit || !isPlayerCollider(hit.collider)) return; // mur touché en premier (jitter, ou joueur sorti du couloir de tir) : raté silencieux.

  ctx.pendingAttackDamage = ctx.cfg.attackDamage;
  ctx.pendingPlayerHitPoint.set(
    eye.x + ctx.scratchJitteredDir.x * hit.timeOfImpact,
    eye.y + ctx.scratchJitteredDir.y * hit.timeOfImpact,
    eye.z + ctx.scratchJitteredDir.z * hit.timeOfImpact,
  );
  ctx.pendingPlayerHitNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);
}

/**
 * Gravité + collage au sol + recul, intégrés et résolus par le
 * `KinematicCharacterController` PARTAGÉ (`updateCtx.kcc`).
 */
function integratePhysics(ctx: EnemyMachineContext, dt: number, updateCtx: EnemyUpdateContext): void {
  if (!ctx.body || !ctx.collider) return; // garde-fou (dead/corpse retournent avant, voir `tickEnemy`).

  const gravityY = updateCtx.physics.gravityY;
  ctx.verticalVelocity += gravityY * dt;
  if (ctx.isGrounded && ctx.verticalVelocity < 0) ctx.verticalVelocity = -ctx.cfg.groundStickSpeed;
  if (ctx.verticalVelocity < -ctx.cfg.maxFallSpeed) ctx.verticalVelocity = -ctx.cfg.maxFallSpeed;

  ctx.desiredScratch.x = (ctx.velocityHorizontal.x + ctx.knockbackVelocity.x) * dt;
  ctx.desiredScratch.y = (ctx.verticalVelocity + ctx.knockbackVelocity.y) * dt;
  ctx.desiredScratch.z = (ctx.velocityHorizontal.z + ctx.knockbackVelocity.z) * dt;

  const collider = ctx.collider;
  updateCtx.kcc.computeColliderMovement(
    collider,
    ctx.desiredScratch,
    RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
    COLLISION_GROUPS.ENEMY,
    (other) => other.handle !== collider.handle,
  );
  updateCtx.kcc.computedMovement(ctx.movementScratch);
  ctx.strideDistance += Math.hypot(ctx.movementScratch.x, ctx.movementScratch.z);
  const grounded = updateCtx.kcc.computedGrounded();
  if (grounded && ctx.verticalVelocity < 0) ctx.verticalVelocity = 0;
  ctx.isGrounded = grounded;

  const current = ctx.body.translation();
  ctx.nextTranslationScratch.set(
    current.x + ctx.movementScratch.x,
    current.y + ctx.movementScratch.y,
    current.z + ctx.movementScratch.z,
  );
  ctx.body.setNextKinematicTranslation(ctx.nextTranslationScratch);
  ctx.position.copy(ctx.nextTranslationScratch);
}

// Machine XState — graphe + actions d'entrée.
// see: docs/systems/entites.md#pourquoi-le-calcul-de-transition-vit-hors-des-gardes-xstate

export type EnemyEvent =
  | { type: "SAW_PLAYER" }
  | { type: "ALERT_ELAPSED" }
  | { type: "TARGET_IN_RANGE" }
  | { type: "CONTACT_LOST" }
  | { type: "ATTACK_RESOLVED" }
  | { type: "STAGGER_ELAPSED" }
  | { type: "HIT_FATAL"; physics: PhysicsWorld }
  | { type: "HIT_NONFATAL"; knockbackDirection: THREE.Vector3 }
  | { type: "DEATH_ANIM_DONE" };

export const enemyMachine = setup({
  types: {} as {
    context: EnemyMachineContext;
    events: EnemyEvent;
    input: EnemyMachineContext;
  },
  actions: {
    resetStateTimer: ({ context }) => {
      context.stateTimer = 0;
    },
    resetTimeSinceLastSeen: ({ context }) => {
      context.timeSinceLastSeen = 0;
    },
    setPendingAlert: ({ context }) => {
      context.pendingAlert = true;
    },
    setPendingTelegraph: ({ context }) => {
      context.pendingTelegraph = true;
    },
    armAttackCooldown: ({ context }) => {
      context.attackCooldownRemaining = context.cfg.attackCooldown;
    },
    /**
     * `* -> dead`. `event` est TOUJOURS `HIT_FATAL` ici (seule transition qui
     * la référence) — XState type `event` sur l'union complète `EnemyEvent`
     * dans chaque action de `setup()`, donc cette vérification est une pure
     * formalité TypeScript pour affiner le type, pas une branche défensive
     * qui peut réellement se déclencher.
     */
    enterDead: ({ context, event }) => {
      if (event.type !== "HIT_FATAL") return;
      context.stateTimer = 0;
      context.hp = 0;
      context.velocityHorizontal.set(0, 0, 0);
      context.knockbackVelocity.set(0, 0, 0);
      detachEnemyPhysics(context, event.physics);
    },
    /** `* -> stagger`. */
    enterStagger: ({ context, event }) => {
      if (event.type !== "HIT_NONFATAL") return;
      context.stateTimer = 0;
      context.knockbackVelocity.set(
        event.knockbackDirection.x * context.cfg.knockbackSpeed,
        context.cfg.knockbackUpBoost,
        event.knockbackDirection.z * context.cfg.knockbackSpeed,
      );
    },
  },
}).createMachine({
  id: "enemy",
  context: ({ input }) => input,
  initial: "idle",
  states: {
    idle: {
      on: {
        SAW_PLAYER: { target: "alert", actions: ["resetStateTimer", "resetTimeSinceLastSeen", "setPendingAlert"] },
        HIT_FATAL: { target: "dead", actions: "enterDead" },
        HIT_NONFATAL: { target: "stagger", actions: "enterStagger" },
      },
    },
    alert: {
      on: {
        ALERT_ELAPSED: { target: "chase", actions: "resetStateTimer" },
        HIT_FATAL: { target: "dead", actions: "enterDead" },
        HIT_NONFATAL: { target: "stagger", actions: "enterStagger" },
      },
    },
    chase: {
      on: {
        TARGET_IN_RANGE: { target: "attack", actions: ["resetStateTimer", "setPendingTelegraph"] },
        CONTACT_LOST: { target: "idle", actions: "resetStateTimer" },
        HIT_FATAL: { target: "dead", actions: "enterDead" },
        HIT_NONFATAL: { target: "stagger", actions: "enterStagger" },
      },
    },
    attack: {
      on: {
        ATTACK_RESOLVED: {
          target: "chase",
          actions: ["resetStateTimer", "armAttackCooldown", "resetTimeSinceLastSeen"],
        },
        HIT_FATAL: { target: "dead", actions: "enterDead" },
        HIT_NONFATAL: { target: "stagger", actions: "enterStagger" },
      },
    },
    stagger: {
      on: {
        STAGGER_ELAPSED: { target: "chase", actions: ["resetStateTimer", "resetTimeSinceLastSeen"] },
        HIT_FATAL: { target: "dead", actions: "enterDead" },
        HIT_NONFATAL: { target: "stagger", actions: "enterStagger" },
      },
    },
    dead: {
      on: {
        DEATH_ANIM_DONE: { target: "corpse" },
      },
    },
    corpse: {},
  },
});

export type EnemyActor = Actor<typeof enemyMachine>;

/** Crée et démarre un acteur — un par entité (`Suit`/`Director`), jamais partagé. */
export function createEnemyActor(context: EnemyMachineContext): EnemyActor {
  return createActor(enemyMachine, { input: context }).start();
}

/**
 * Réservé aux SETTERS publics `Suit.state`/`Director.state` — jamais appelé
 * par le chemin de production (`tickEnemy`/`applyEnemyDamageCore`).
 * see: docs/systems/entites.md#réassigner-létat-depuis-les-tests-sans-casser-lencapsulation
 */
export function forceEnemyState(actor: EnemyActor, next: EnemyState): void {
  const context = actor.getSnapshot().context;
  const resolved = enemyMachine.resolveState({ value: next, context });
  (actor as unknown as { _snapshot: unknown })._snapshot = resolved;
}

// Décisions par état. `actor` n'est utilisé que pour `send(...)`, jamais
// relu (voir `tickEnemy`, qui a déjà extrait `ctx`/`state` une fois pour
// toutes ce pas-ci).

function runIdle(actor: EnemyActor, ctx: EnemyMachineContext, updateCtx: EnemyUpdateContext, distance: number): void {
  if (cheats.notarget) return; // dev : jamais de repérage, donc jamais d'alerte
  if (distance > ctx.cfg.sightRange) return;
  const eye = computeEyePosition(ctx, ctx.scratchEye);
  if (!hasClearWorldPath(updateCtx.physics, eye, updateCtx.playerEyePosition, ctx.scratchRay)) return;

  actor.send({ type: "SAW_PLAYER" });
}

function runAlert(actor: EnemyActor, ctx: EnemyMachineContext, dt: number): void {
  ctx.stateTimer += dt;
  turnTowards(ctx, ctx.scratchToPlayer, dt);
  // Transition INCONDITIONNELLE après `alertDuration` : ne re-vérifie pas la
  // ligne de vue ici, choix délibéré.
  if (ctx.stateTimer >= ctx.cfg.alertDuration) {
    actor.send({ type: "ALERT_ELAPSED" });
  }
}

function runChase(
  actor: EnemyActor,
  ctx: EnemyMachineContext,
  updateCtx: EnemyUpdateContext,
  dt: number,
  distance: number,
): void {
  const eye = computeEyePosition(ctx, ctx.scratchEye);
  const inSight =
    !cheats.notarget &&
    distance <= ctx.cfg.sightRange &&
    hasClearWorldPath(updateCtx.physics, eye, updateCtx.playerEyePosition, ctx.scratchRay);

  // Sous `notarget`, le contact est perdu TOUT DE SUITE plutôt qu'au bout de
  // `lostContactTimeout` : on veut se promener, pas être suivi cinq secondes
  // par un ennemi déjà lancé quand la bascule est activée.
  if (inSight) ctx.timeSinceLastSeen = 0;
  else ctx.timeSinceLastSeen = cheats.notarget ? ctx.cfg.lostContactTimeout : ctx.timeSinceLastSeen + dt;

  if (ctx.timeSinceLastSeen >= ctx.cfg.lostContactTimeout) {
    actor.send({ type: "CONTACT_LOST" });
    return;
  }

  if (inSight && distance <= ctx.cfg.attackRange && ctx.attackCooldownRemaining <= 0) {
    turnTowards(ctx, ctx.scratchToPlayer, dt);
    actor.send({ type: "TARGET_IN_RANGE" });
    return;
  }

  // Jalon M4 : suivi de chemin réel en priorité, repli EXPLICITE sur
  // l'évitement local historique si aucun graphe n'est encore baké ou si
  // aucun chemin n'a pu être trouvé.
  if (tryComputeChaseDirectionFromPath(ctx, updateCtx, ctx.scratchMoveDir)) {
    ctx.velocityHorizontal.copy(ctx.scratchMoveDir).multiplyScalar(ctx.cfg.chaseSpeed);
    turnTowards(ctx, ctx.scratchMoveDir.lengthSq() > 1e-8 ? ctx.scratchMoveDir : ctx.scratchToPlayer, dt);
    return;
  }

  const avoided = computeAvoidedDirection(ctx, updateCtx.physics, ctx.scratchToPlayer, ctx.scratchMoveDir);
  ctx.velocityHorizontal.copy(avoided).multiplyScalar(ctx.cfg.chaseSpeed);
  turnTowards(ctx, ctx.scratchToPlayer.lengthSq() > 1e-8 ? ctx.scratchToPlayer : avoided, dt);
}

function runAttack(actor: EnemyActor, ctx: EnemyMachineContext, updateCtx: EnemyUpdateContext, dt: number): void {
  turnTowards(ctx, ctx.scratchToPlayer, dt);
  ctx.stateTimer += dt;
  if (ctx.stateTimer < ctx.cfg.attackTelegraphDuration) return; // pose TIR tenue = la télégraphie visuelle exigée par le skill.

  resolveAttack(ctx, updateCtx);
  actor.send({ type: "ATTACK_RESOLVED" });
}

function runStagger(actor: EnemyActor, ctx: EnemyMachineContext, dt: number): void {
  ctx.stateTimer += dt;
  if (ctx.stateTimer >= ctx.cfg.staggerDuration) {
    actor.send({ type: "STAGGER_ELAPSED" });
  }
}

/**
 * Un pas fixe. `dt` est le dt de GAMEPLAY (scalé par le hitstop) — jamais
 * d'horloge murale. Remplace le corps entier de `Suit.update`/
 * `Director.update` avant ce jalon (préambule + `switch` + intégration
 * physique) — les deux classes deviennent de fins appels à cette fonction.
 *
 * PRÉCONDITION (inchangée) : l'appelant (`SuitManager`/`DirectorManager`)
 * n'appelle PAS `tickEnemy` le pas fixe où cette entité vient d'encaisser un
 * coup — `applyEnemyDamageCore`/le `send` qui suit gèrent ce pas-là.
 */
export function tickEnemy(actor: EnemyActor, dt: number, updateCtx: EnemyUpdateContext): void {
  const snapshot = actor.getSnapshot();
  const ctx = snapshot.context;
  const state = snapshot.value;

  ctx.pendingAlert = false;
  ctx.pendingTelegraph = false;
  ctx.pendingAttackDamage = 0;
  ctx.animClock += dt;
  ctx.timeSinceShot += dt;

  if (state === "corpse") return; // figé, rien à faire (pas d'allocation, pas de raycast).

  if (state === "dead") {
    ctx.stateTimer += dt;
    if (ctx.stateTimer >= ctx.cfg.deathFrameDuration * ctx.deathFrameCount) {
      actor.send({ type: "DEATH_ANIM_DONE" });
    }
    return;
  }

  updateKnockback(ctx, dt);
  ctx.attackCooldownRemaining = Math.max(0, ctx.attackCooldownRemaining - dt);

  ctx.scratchToPlayer.subVectors(updateCtx.playerTargetPosition, ctx.position);
  ctx.scratchToPlayer.y = 0;
  const distance = ctx.scratchToPlayer.length();
  if (distance > 1e-4) ctx.scratchToPlayer.multiplyScalar(1 / distance);

  ctx.velocityHorizontal.set(0, 0, 0);

  switch (state) {
    case "idle":
      runIdle(actor, ctx, updateCtx, distance);
      break;
    case "alert":
      runAlert(actor, ctx, dt);
      break;
    case "chase":
      runChase(actor, ctx, updateCtx, dt, distance);
      break;
    case "attack":
      runAttack(actor, ctx, updateCtx, dt);
      break;
    case "stagger":
      runStagger(actor, ctx, dt);
      break;
  }

  integratePhysics(ctx, dt, updateCtx);
}

export type EnemyDamageOutcome = "already-dead" | "fatal" | "nonfatal";

/**
 * Garde `isAlive` + soustraction de `amount` — s'ARRÊTE avant d'envoyer quoi
 * que ce soit à l'acteur : c'est à l'appelant (`Suit.applyDamage`/
 * `Director.applyDamage`) de décider quel évènement envoyer ET, pour
 * `Director`, d'observer `hp` juste après la soustraction (calcul de
 * `revealed`) avant que `enterDead` ne le remette à 0.
 */
export function applyEnemyDamageCore(actor: EnemyActor, amount: number): EnemyDamageOutcome {
  const snapshot = actor.getSnapshot();
  if (snapshot.value === "dead" || snapshot.value === "corpse") return "already-dead"; // garde-fou, ne devrait jamais arriver.
  snapshot.context.hp -= amount;
  return snapshot.context.hp <= 0 ? "fatal" : "nonfatal";
}

export function snapshotEnemyPrevious(ctx: EnemyMachineContext): void {
  ctx.previousPosition.copy(ctx.position);
  ctx.previousForward.copy(ctx.forward);
}

export function interpolateEnemyPosition(ctx: EnemyMachineContext, alpha: number, out: THREE.Vector3): THREE.Vector3 {
  return out.lerpVectors(ctx.previousPosition, ctx.position, alpha);
}

export function interpolateEnemyForward(ctx: EnemyMachineContext, alpha: number, out: THREE.Vector3): THREE.Vector3 {
  out.lerpVectors(ctx.previousForward, ctx.forward, alpha);
  if (out.lengthSq() < 1e-8) out.copy(ctx.forward);
  return out.normalize();
}
