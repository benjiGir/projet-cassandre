import type * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

import type { PhysicsWorld } from "../../../physics/world";
import type { NavGraph } from "../../level/navigation/pathfindingTypes";

// see: docs/6-reference/notes-code-gameplay-ennemis.md#état-et-horloges

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

  /** Attaque au corps-à-corps ; absent = tir à distance (Costard, Directeur). */
  melee?: EnemyMeleeConfig;
}

export interface EnemyMeleeConfig {
  /** Distance horizontale, en mètres, sous laquelle le coup porte à la fin de l'élan. */
  reach: number;
  /** Vitesse du bond vers le joueur pendant l'élan, m/s. */
  lungeSpeed: number;
}

export type EnemyLiveState = "idle" | "alert" | "chase" | "attack" | "stagger";

export type EnemyState = EnemyLiveState | "dead" | "corpse";

export interface BreakableHitTarget {
  tryBreakByColliderHandle(colliderHandle: number, point: THREE.Vector3, direction: THREE.Vector3): boolean;
}

export type VitreHitTarget = BreakableHitTarget;

export interface EnemyUpdateContext {
  physics: PhysicsWorld;
  /** Contrôleur PARTAGÉ — une seule instance, possédée par `SuitManager`/`DirectorManager`. */
  kcc: RAPIER.KinematicCharacterController;
  playerTargetPosition: THREE.Vector3;
  playerEyePosition: THREE.Vector3;
  navGraph: NavGraph | null;
  /** Part de `sightRange` à laquelle un ennemi AU REPOS repère le joueur ; absent = 1. */
  sightRangeScale?: number;
  // see: docs/decisions/0031-portes-animees-et-vitres.md
  vitreSystem?: BreakableHitTarget;
  // see: docs/decisions/0032-sanitaires-utilisables.md
  sanitaireSystem?: BreakableHitTarget;
}

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
  // see: docs/archive/systems-entites.md#deux-catégories-de-données-dans-le-contexte-minuteurs-détat-et-mémoire-persistante
  timeSinceLastSeen: number;
  /** Idem. */
  attackCooldownRemaining: number;
  isGrounded: boolean;
  verticalVelocity: number;

  readonly velocityHorizontal: THREE.Vector3;
  readonly knockbackVelocity: THREE.Vector3;

  pendingAlert: boolean;
  pendingTelegraph: boolean;
  /** Le coup est parti ce pas (touché ou non) : le son du tir, distinct des dégâts. */
  pendingShot: boolean;
  pendingAttackDamage: number;
  readonly pendingPlayerHitPoint: THREE.Vector3;
  readonly pendingPlayerHitNormal: THREE.Vector3;

  currentPath: ReadonlyArray<THREE.Vector3>;
  currentWaypointIndex: number;
  readonly lastPathQueryTarget: THREE.Vector3;

  /** Nombre de frames de l'animation de mort — `DEATH_FRAME_COUNT`/`DIRECTOR_DEATH_FRAME_COUNT`, fourni par le wrapper à la construction plutôt que codé en dur ici. */
  readonly deathFrameCount: number;

  /** Secondes de gameplay depuis l'apparition. */
  animClock: number;
  /** Mètres parcourus depuis l'apparition : font défiler la course. */
  strideDistance: number;
  /** Secondes depuis le dernier tir réellement parti. */
  timeSinceShot: number;

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
  /** Point d'impact d'un tir ennemi qui rate le joueur — voir `handleEnemyShotMiss`. */
  readonly scratchEnemyShotPoint: THREE.Vector3;
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

export type EnemyDamageOutcome = "already-dead" | "fatal" | "nonfatal";
