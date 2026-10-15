import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

import type { PhysicsWorld } from "../../../physics/world";
import type { EnemyAnimationInput } from "../../../render/sprites/enemySpriteTypes";
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
import { createEnemyBody } from "./enemyPhysics";
import type { EnemyConfig, EnemyMachineContext, EnemyState, EnemyUpdateContext } from "./enemyTypes";
import { allocateEntityId, type Entity } from "./entity";

/** La machine partagée lit `EnemyConfig` ; les PV de départ sont dans la config de chaque espèce. */
export type EntityConfig = EnemyConfig & { readonly maxHp: number };

// Ce que tout ennemi partage : un corps Rapier, une machine à états, et les
// accès que le gestionnaire, le rendu et les tests lisent. Chaque espèce n'y
// ajoute que ce qui lui est propre.
// see: docs/archive/systems-entites.md#suit-et-director-deux-fines-couches-au-dessus-de-la-machine-partagée
export abstract class EnemyEntity<TConfig extends EntityConfig> implements Entity {
  readonly id: number;
  readonly cfg: TConfig;
  protected actor: EnemyActor;

  constructor(
    physics: PhysicsWorld,
    spawnPosition: THREE.Vector3,
    spawnForward: THREE.Vector3,
    seed: number,
    cfg: TConfig,
    deathFrameCount: number,
  ) {
    this.id = allocateEntityId();
    this.cfg = cfg;

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
      deathFrameCount,
    });

    this.actor = createEnemyActor(context);
  }

  /** Contexte XState courant — un seul point d'accès, tous les getters/setters ci-dessous en dérivent. */
  protected get ctx(): EnemyMachineContext {
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
  /** Orientation horizontale (unitaire, Y=0). `direction = 0` du billboard = vu de face. */
  get forward(): THREE.Vector3 {
    return this.ctx.forward;
  }
  get previousForward(): THREE.Vector3 {
    return this.ctx.previousForward;
  }

  /** Le setter force un état sans passer par une transition : un outil de test et de console, jamais du gameplay. */
  get state(): EnemyState {
    return this.actor.getSnapshot().value;
  }
  set state(next: EnemyState) {
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
  get pendingPlayerPush(): THREE.Vector3 {
    return this.ctx.pendingPlayerPush;
  }
  get pendingPushDuration(): number {
    return this.ctx.pendingPushDuration;
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

  /** Entrées d'animation du sprite, écrites dans `out` — voir `render/sprites/enemySprites.ts::enemySpriteRow`. */
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

  applyDamage(
    amount: number,
    physics: PhysicsWorld,
    knockbackDirection: THREE.Vector3,
    interruptCharge = true,
  ): { died: boolean } {
    const outcome = applyEnemyDamageCore(this.actor, amount);
    if (outcome === "already-dead") return { died: false }; // garde-fou : le gestionnaire ne vise que des vivants.

    if (outcome === "fatal") {
      this.actor.send({ type: "HIT_FATAL", physics });
      return { died: true };
    }

    if (interruptCharge || !this.cfg.charge || (this.state !== "attack" && this.state !== "charge")) {
      this.actor.send({ type: "HIT_NONFATAL", knockbackDirection });
    }
    return { died: false };
  }

  update(dt: number, ctx: EnemyUpdateContext) {
    tickEnemy(this.actor, dt, ctx);
  }
}
