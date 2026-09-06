import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import type { PhysicsWorld } from "../../physics/world";
import { allocateEntityId, type Entity } from "./entity";
import { suitConfig as defaultSuitConfig, type SuitConfig } from "./suitConfig";
import {
  applyEnemyDamageCore,
  configureEnemyCharacterController,
  createEnemyActor,
  createEnemyBody,
  createEnemyMachineContext,
  createEnemyPrng,
  enemySpriteRow,
  ENEMY_DEATH_ROW_BASE,
  ENEMY_LIVE_STATE_ROW,
  forceEnemyState,
  interpolateEnemyForward,
  interpolateEnemyPosition,
  snapshotEnemyPrevious,
  tickEnemy,
  type EnemyActor,
  type EnemyMachineContext,
  type EnemyState,
  type EnemyUpdateContext,
} from "./enemyMachine";

/**
 * L'ennemi « Costard » — Phase 3 (skills `enemy-state-machine`,
 * `billboard-sprites-8dir`). Fin wrapper autour de la machine XState
 * partagée avec `Director` (`enemyMachine.ts`) : ne possède que le
 * corps/collider Rapier, sa config, son PRNG et son acteur XState — voir la
 * frontière exacte et la discipline de pureté/déterminisme tenue ici.
 * see: docs/systems/entites.md#suit-et-director-deux-fines-couches-au-dessus-de-la-machine-partagée
 * see: docs/decisions/0009-machine-partagee-suit-director.md
 */

/** Nombre de frames de l'animation de mort (deliverable Phase 3 : 4 frames). */
export const DEATH_FRAME_COUNT = 4;

/**
 * Nombre de lignes de l'atlas 8×N attendu par `createPlaceholderAtlas`/
 * `BillboardSprite` : 5 poses d'état distinctes (IDLE, ALERTE, POURSUITE,
 * TIR, RECUL) + 4 frames de mort dédiées (CADAVRE réutilise la dernière).
 */
export const SUIT_ATLAS_ROWS = 5 + DEATH_FRAME_COUNT;

/** États de la machine, mappés sur les noms français du plan/skill en commentaire — alias de `EnemyState` (`enemyMachine.ts`), même union littérale. */
export type SuitState = EnemyState;

/** Exposée pour documentation/débogage (`cassandre.suitConfig`, mosaïque de diagnostic). */
export const SUIT_STATE_ROWS = {
  ...ENEMY_LIVE_STATE_ROW,
  deathBase: ENEMY_DEATH_ROW_BASE,
} as const;

/**
 * Contexte partagé injecté à chaque `Suit.update()` par `SuitManager` — alias
 * de `EnemyUpdateContext` (`enemyMachine.ts`), inchangé au caractère près
 * pour ne rien casser côté appelants (`SuitManager`).
 */
export type SuitUpdateContext = EnemyUpdateContext;

export class Suit implements Entity {
  readonly id: number;
  private readonly actor: EnemyActor;
  private readonly cfg: SuitConfig;

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

  /**
   * État courant. Getter dérivé de l'acteur XState ; setter conservé pour
   * COMPATIBILITÉ AVEC LE FILET DE TEST DE CARACTÉRISATION (voir la doc de
   * `forceEnemyState` dans `enemyMachine.ts`) — jamais utilisé par le
   * chemin de production, qui transite uniquement par `enemyMachine`/
   * `tickEnemy`/`applyEnemyDamageCore`.
   */
  get state(): SuitState {
    return this.actor.getSnapshot().value as SuitState;
  }
  set state(next: SuitState) {
    forceEnemyState(this.actor, next);
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

  // --- Sorties lues par `SuitManager` juste après `update()`, remises à
  // zéro par `enemyMachine.ts::tickEnemy` au tick suivant.
  get pendingAlert(): boolean {
    return this.ctx.pendingAlert;
  }
  get pendingTelegraph(): boolean {
    return this.ctx.pendingTelegraph;
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

  /**
   * Vélocité horizontale de poursuite/évitement, et vélocité de recul
   * (knockback) — privées côté TypeScript mais exposées en accesseurs JS
   * ordinaires : `test/game/entities/suit.test.ts` y accède via un cast
   * (`(suit as unknown as { velocityHorizontal: THREE.Vector3 })`). Pas
   * `private` : `tsc --noEmit` (`noUnusedLocals`) signalerait sinon un
   * membre jamais lu DEPUIS LA CLASSE elle-même comme mort. Usage interne/
   * diagnostic uniquement, comme `body`/`collider`.
   */
  get velocityHorizontal(): THREE.Vector3 {
    return this.ctx.velocityHorizontal;
  }
  get knockbackVelocity(): THREE.Vector3 {
    return this.ctx.knockbackVelocity;
  }

  /** Ligne d'atlas de la pose courante — voir `SUIT_ATLAS_ROWS`. Diagnostic direct : chaque état vivant a sa ligne, la mort en a 4 dédiées. */
  get spriteRow(): number {
    return enemySpriteRow(this.state, this.stateTimer, this.cfg.deathFrameDuration, DEATH_FRAME_COUNT);
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

  /**
   * Applique `amount` dégâts. Retourne `{ died }`. Ne touche à AUCUN système
   * de rendu/audio/state — `SuitManager` lit le résultat et construit
   * l'événement approprié (`hurtEvents` ou `deathEvents`).
   *
   * KNOCKBACK : le Costard est kinématique, `RAPIER.RigidBody.applyImpulse`
   * n'aurait aucun effet. `knockbackDirection` (horizontale, normalisée,
   * fournie par l'appelant) est convertie en VÉLOCITÉ interne par l'action
   * `enterStagger` de `enemyMachine.ts`, décroissante sur
   * `knockbackDecayTime` (voir `updateKnockback`, `enemyMachine.ts`).
   */
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
    tickEnemy(this.actor, dt, ctx);
  }
}

/**
 * Applique la configuration `SuitConfig` à un `KinematicCharacterController`
 * brut — re-export de la fabrique PARTAGÉE (`enemyMachine.ts`), gardé sous ce
 * nom pour `SuitManager` (inchangé par ce jalon).
 */
export function configureSuitCharacterController(controller: RAPIER.KinematicCharacterController, cfg: SuitConfig) {
  configureEnemyCharacterController(controller, cfg);
}
