import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { type LoyaltyCard } from "../player/loyaltyCards";
import type { PhysicsWorld } from "../../physics/world";
import { allocateEntityId, type Entity } from "./entity";
import { directorConfig as defaultDirectorConfig, type DirectorConfig } from "./directorConfig";
import {
  applyEnemyDamageCore,
  configureEnemyCharacterController,
  createEnemyActor,
  createEnemyBody,
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
import type { EnemyMachineContext, EnemyState, EnemyUpdateContext } from "./enemyTypes";
import type { EnemyAnimationInput } from "../../render/enemySpriteTypes";

// see: docs/archive/systems-entites.md#suit-et-director-deux-fines-couches-au-dessus-de-la-machine-partagée

/** Frames de l'animation de mort — même choix que `Suit` (6 frames, 0,9 s au `deathFrameDuration` du Directeur). */
export const DIRECTOR_DEATH_FRAME_COUNT = 6;

/** États de la machine — alias de `EnemyState` (`enemyTypes.ts`), même union littérale que `SuitState`. */
export type DirectorState = EnemyState;

/** Contexte partagé injecté à chaque `Director.update()` — alias de `EnemyUpdateContext` (`enemyTypes.ts`), même graphe partagé (baké sur le gabarit `suitConfig`, voir `level/pathfinding.ts`), même filet de sécurité `computeAvoidedDirection` si `null`/requête échouée. */
export type DirectorUpdateContext = EnemyUpdateContext;

// see: docs/6-reference/notes-code-gameplay-ennemis.md#état-et-horloges
export interface DirectorDamageResult {
  died: boolean;
  justRevealed: boolean;
}

export class Director implements Entity {
  readonly id: number;
  private readonly actor: EnemyActor;
  private readonly cfg: DirectorConfig;

  revealed = false;

  constructor(
    physics: PhysicsWorld,
    spawnPosition: THREE.Vector3,
    spawnForward: THREE.Vector3,
    seed: number,
    cfg: DirectorConfig = defaultDirectorConfig,
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
      deathFrameCount: DIRECTOR_DEATH_FRAME_COUNT,
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

  get position(): THREE.Vector3 {
    return this.ctx.position;
  }
  get previousPosition(): THREE.Vector3 {
    return this.ctx.previousPosition;
  }
  get forward(): THREE.Vector3 {
    return this.ctx.forward;
  }
  get previousForward(): THREE.Vector3 {
    return this.ctx.previousForward;
  }

  /** État courant — voir la doc identique dans `suit.ts` (`Suit.state`) pour la justification du setter (filet de test de caractérisation, `forceEnemyState`). */
  get state(): DirectorState {
    return this.actor.getSnapshot().value as DirectorState;
  }
  set state(next: DirectorState) {
    forceEnemyState(this.actor, next);
  }

  get hp(): number {
    return this.ctx.hp;
  }

  /** Voir la doc identique dans `suit.ts` (`Suit.stateTimer`). */
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

  /** Même contrat que `Suit.velocityHorizontal`/`Suit.knockbackVelocity` (accès par cast depuis `director.test.ts`, pas `private` pour la même raison — voir `suit.ts`). */
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

  /** Teinte à appliquer sur le sprite (`BillboardSprite.setTint`) pour l'état de révélation courant. */
  get tintColor(): number {
    return this.revealed ? this.cfg.revealedTintColor : this.cfg.humanTintColor;
  }

  /** À appeler avant `stepPhysics`, comme `Suit.snapshotPrevious`. */
  snapshotPrevious() {
    snapshotEnemyPrevious(this.ctx);
  }

  /** Position interpolée pour le rendu — même contrat que `Suit.interpolatedPosition`. */
  interpolatedPosition(alpha: number, out: THREE.Vector3): THREE.Vector3 {
    return interpolateEnemyPosition(this.ctx, alpha, out);
  }

  /** Orientation interpolée pour le rendu — même contrat que `Suit.interpolatedForward`. */
  interpolatedForward(alpha: number, out: THREE.Vector3): THREE.Vector3 {
    return interpolateEnemyForward(this.ctx, alpha, out);
  }

  applyDamage(amount: number, physics: PhysicsWorld, knockbackDirection: THREE.Vector3): DirectorDamageResult {
    const wasRevealed = this.revealed;
    const outcome = applyEnemyDamageCore(this.actor, amount);
    if (outcome === "already-dead") return { died: false, justRevealed: false }; // garde-fou, ne devrait jamais arriver.

    if (this.hp <= this.cfg.revealHpFraction * this.cfg.maxHp) {
      this.revealed = true;
    }
    const justRevealed = this.revealed && !wasRevealed;

    if (outcome === "fatal") {
      this.actor.send({ type: "HIT_FATAL", physics });
      return { died: true, justRevealed };
    }

    this.actor.send({ type: "HIT_NONFATAL", knockbackDirection });
    return { died: false, justRevealed };
  }

  // see: docs/6-reference/notes-code-gameplay-ennemis.md#dégâts-et-événements
  update(dt: number, ctx: DirectorUpdateContext) {
    tickEnemy(this.actor, dt, ctx);
  }
}

export function configureDirectorCharacterController(
  controller: RAPIER.KinematicCharacterController,
  cfg: DirectorConfig,
) {
  configureEnemyCharacterController(controller, cfg);
}

// see: docs/archive/systems-entites.md#carte-lâchée-par-le-directeur
export class DroppedCard {
  readonly position: THREE.Vector3;
  /** Carte que ce drop donne au ramassage. Le Directeur lâche la Platine ;
   * le champ existe pour que le drop ne préjuge de rien (jalon N7). */
  readonly card: LoyaltyCard;
  collected = false;

  /** Secondes écoulées depuis l'apparition — voir `DirectorConfig.cardPickupDelay`. */
  private age = 0;

  constructor(position: THREE.Vector3, card: LoyaltyCard) {
    this.position = position.clone();
    this.card = card;
  }

  /** Avance l'âge du drop d'un pas fixe — appelé par `DirectorManager.update`, jamais par une horloge murale. */
  tick(dt: number): void {
    this.age += dt;
  }

  tryCollect(playerPosition: THREE.Vector3, pickupRadius: number, minAge: number): boolean {
    if (this.collected) return false;
    if (this.age < minAge) return false;
    if (this.position.distanceToSquared(playerPosition) > pickupRadius * pickupRadius) return false;
    this.collected = true;
    return true;
  }
}
