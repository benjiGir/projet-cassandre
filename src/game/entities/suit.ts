import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import type { PhysicsWorld } from "../../physics/world";
import { allocateEntityId, type Entity } from "./entity";
import { suitConfig as defaultSuitConfig, type SuitConfig } from "./suitConfig";
import {
  applyEnemyDamageCore,
  createEnemyActor,
  createEnemyMachineContext,
  createEnemyPrng,
  forceEnemyState,
  interpolateEnemyForward,
  interpolateEnemyPosition,
  readEnemyAnimation,
  snapshotEnemyPrevious,
  tickEnemy,
  type EnemyActor,
} from "./enemyMachine";
import { createEnemyBody, configureEnemyCharacterController } from "./enemyPhysics";
import type { EnemyMachineContext, EnemyState, EnemyUpdateContext } from "./enemyTypes";
import type { EnemyAnimationInput } from "../../render/enemySpriteTypes";

// see: docs/archive/systems-entites.md#suit-et-director-deux-fines-couches-au-dessus-de-la-machine-partagée

// see: docs/6-reference/notes-code-gameplay-ennemis.md#dégâts-et-événements
export const DEATH_FRAME_COUNT = 6;

/** États de la machine, mappés sur les noms français du plan/skill en commentaire — alias de `EnemyState` (`enemyTypes.ts`), même union littérale. */
export type SuitState = EnemyState;

// see: docs/6-reference/notes-code-gameplay-ennemis.md#état-et-horloges
export type SuitUpdateContext = EnemyUpdateContext;

export class Suit implements Entity {
  readonly id: number;
  private actor: EnemyActor;

  constructor(
    physics: PhysicsWorld,
    spawnPosition: THREE.Vector3,
    spawnForward: THREE.Vector3,
    seed: number,
    cfg: SuitConfig = defaultSuitConfig,
  ) {
    this.id = allocateEntityId();

    const { body, collider, centerY } = createEnemyBody(physics, cfg, spawnPosition);

    const forward = spawnForward.clone();
    forward.y = 0;
    if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1);
    forward.normalize();

    const context = createEnemyMachineContext({
      cfg,
      nextRandom: createEnemyPrng(seed),
      body,
      collider,
      centerPosition: new THREE.Vector3(spawnPosition.x, centerY, spawnPosition.z),
      forward,
      hp: cfg.maxHp,
      deathFrameCount: DEATH_FRAME_COUNT,
    });

    this.actor = createEnemyActor(context);
  }

  /** Contexte XState courant — un seul point d'accès, tous les getters/setters ci-dessous en dérivent. */
  private get ctx(): EnemyMachineContext {
    return this.actor.getSnapshot().context;
  }

  get body(): RAPIER.RigidBody | null {
    return this.ctx.body;
  }
  get collider(): RAPIER.Collider | null {
    return this.ctx.collider;
  }

  /** Centre de la capsule au pas fixe courant. */
  get position(): THREE.Vector3 {
    return this.ctx.position;
  }
  get previousPosition(): THREE.Vector3 {
    return this.ctx.previousPosition;
  }
  /** Orientation horizontale (unitaire, Y=0). `direction = 0` du billboard = vu de face, voir `billboard-sprites-8dir`. */
  get forward(): THREE.Vector3 {
    return this.ctx.forward;
  }
  get previousForward(): THREE.Vector3 {
    return this.ctx.previousForward;
  }

  get state(): SuitState {
    return this.actor.getSnapshot().value as SuitState;
  }
  set state(next: SuitState) {
    this.actor = forceEnemyState(this.actor, next);
  }

  get hp(): number {
    return this.ctx.hp;
  }

  /** Temps écoulé (secondes de pas fixe) depuis la dernière transition d'état. Setter conservé pour la même raison que `state`. */
  get stateTimer(): number {
    return this.ctx.stateTimer;
  }
  set stateTimer(value: number) {
    this.ctx.stateTimer = value;
  }

  get pendingAlert(): boolean {
    return this.ctx.pendingAlert;
  }
  get pendingTelegraph(): boolean {
    return this.ctx.pendingTelegraph;
  }
  get pendingShot(): boolean {
    return this.ctx.pendingShot;
  }
  get pendingAttackDamage(): number {
    return this.ctx.pendingAttackDamage;
  }
  get pendingPlayerHitPoint(): THREE.Vector3 {
    return this.ctx.pendingPlayerHitPoint;
  }
  get pendingPlayerHitNormal(): THREE.Vector3 {
    return this.ctx.pendingPlayerHitNormal;
  }

  get isAlive(): boolean {
    const value = this.actor.getSnapshot().value;
    return value !== "dead" && value !== "corpse";
  }

  get velocityHorizontal(): THREE.Vector3 {
    return this.ctx.velocityHorizontal;
  }
  get knockbackVelocity(): THREE.Vector3 {
    return this.ctx.knockbackVelocity;
  }

  /** Entrées d'animation du sprite, écrites dans `out` — voir `render/enemySprites.ts::enemySpriteRow`. */
  animation(out: EnemyAnimationInput): EnemyAnimationInput {
    return readEnemyAnimation(this.actor, out);
  }

  /** À appeler avant `stepPhysics`, comme `PlayerController.snapshotPrevious`. */
  snapshotPrevious() {
    snapshotEnemyPrevious(this.ctx);
  }

  /** Position interpolée pour le rendu. `out` DOIT être passé à `BillboardSprite.updatePose` (jamais une valeur brute du pas fixe). */
  interpolatedPosition(alpha: number, out: THREE.Vector3): THREE.Vector3 {
    return interpolateEnemyPosition(this.ctx, alpha, out);
  }

  /** Orientation interpolée pour le rendu, toujours renormalisée et non nulle. */
  interpolatedForward(alpha: number, out: THREE.Vector3): THREE.Vector3 {
    return interpolateEnemyForward(this.ctx, alpha, out);
  }

  applyDamage(amount: number, physics: PhysicsWorld, knockbackDirection: THREE.Vector3): { died: boolean } {
    const outcome = applyEnemyDamageCore(this.actor, amount);
    if (outcome === "already-dead") return { died: false }; // garde-fou : ne devrait jamais arriver, voir `SuitManager`.

    if (outcome === "fatal") {
      this.actor.send({ type: "HIT_FATAL", physics });
      return { died: true };
    }

    this.actor.send({ type: "HIT_NONFATAL", knockbackDirection });
    return { died: false };
  }

  update(dt: number, ctx: SuitUpdateContext) {
    tickEnemy(this.actor, dt, ctx);
  }
}

export function configureSuitCharacterController(controller: RAPIER.KinematicCharacterController, cfg: SuitConfig) {
  configureEnemyCharacterController(controller, cfg);
}
