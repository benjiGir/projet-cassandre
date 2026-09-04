import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

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
 * L'ennemi « Directeur » — boss unique de fin (Zone E), 2ᵉ type d'ennemi du
 * jeu après `Suit`, dédupliqué avec lui au jalon M5 (PLAN_EFFECT_XSTATE.md,
 * §7) : ce fichier ne contient plus sa PROPRE copie de la logique de
 * décision (elle vit UNE SEULE FOIS dans `enemyMachine.ts`, partagée avec
 * `suit.ts`) — `Director` est désormais un fin wrapper qui possède le
 * corps/collider Rapier, le PRNG dérivé de sa graine, l'acteur XState
 * partagé, ET, propre à ce type d'ennemi, `revealed`/`justRevealed` (la
 * bascule costume humain -> reptilien) et le badge droppé à la mort
 * (`DirectorBadge`) — restés HORS de la machine partagée sur demande
 * explicite de la tâche : un champ de contexte ANNEXE porté par CETTE
 * classe, pas une région d'état parallèle de `enemyMachine`.
 *
 * PURETÉ DU CŒUR DE SIMULATION (même discipline qu'avant ce jalon) : ce
 * fichier n'importe RIEN de `render/billboard.ts`, `render/fx.ts`,
 * `core/audio.ts`, ni `game/state.ts`.
 *
 * DÉTERMINISME : PRNG mulberry32 seedé PAR ENTITÉ (`createEnemyPrng`,
 * `enemyMachine.ts`), jamais `Math.random()`.
 *
 * DÉPLACEMENT : `RAPIER.KinematicCharacterController` PARTAGÉ — voir
 * `DirectorManager` (une seule instance, comme `SuitManager`).
 */

/** Nombre de frames de l'animation de mort — même choix que `Suit` (4 frames). */
export const DIRECTOR_DEATH_FRAME_COUNT = 4;

/**
 * Nombre de lignes de l'atlas 8×N attendu par `BillboardSprite` — MÊME
 * disposition que `SUIT_ATLAS_ROWS`. La révélation (costume humain ->
 * reptilien) N'AJOUTE PAS de lignes ici : elle est rendue par une TEINTE
 * (`BillboardSprite.setTint`, voir `tintColor`) appliquée par-dessus les
 * mêmes lignes d'état.
 */
export const DIRECTOR_ATLAS_ROWS = 5 + DIRECTOR_DEATH_FRAME_COUNT;

/** États de la machine — alias de `EnemyState` (`enemyMachine.ts`), même union littérale que `SuitState`. */
export type DirectorState = EnemyState;

/** Exposée pour documentation/débogage (mosaïque de diagnostic états × directions). */
export const DIRECTOR_STATE_ROWS = {
  ...ENEMY_LIVE_STATE_ROW,
  deathBase: ENEMY_DEATH_ROW_BASE,
} as const;

/** Contexte partagé injecté à chaque `Director.update()` — alias de `EnemyUpdateContext` (`enemyMachine.ts`), même graphe partagé (baké sur le gabarit `suitConfig`, voir `level/pathfinding.ts`), même filet de sécurité `computeAvoidedDirection` si `null`/requête échouée. */
export type DirectorUpdateContext = EnemyUpdateContext;

/**
 * Résultat d'`applyDamage` — contrairement à `Suit` (qui ne renvoie que
 * `{ died }`), le Directeur ajoute `justRevealed` : `true` UNE SEULE FOIS, au
 * pas fixe précis où ses PV passent SOUS `revealHpFraction * maxHp` pour la
 * première fois.
 */
export interface DirectorDamageResult {
  died: boolean;
  justRevealed: boolean;
}

export class Director implements Entity {
  readonly id: number;
  private readonly actor: EnemyActor;
  private readonly cfg: DirectorConfig;

  /**
   * `true` dès que les PV sont passés sous le seuil de révélation — jamais
   * remis à `false` (pas de mécanique de soin dans ce prototype). Pilote
   * l'apparence (teinte) via ce champ, pas via `state` : orthogonal à la
   * machine à états PARTAGÉE (un Directeur révélé continue de traverser
   * idle/alert/chase/attack/stagger normalement) — champ de contexte ANNEXE
   * propre à `Director`, voir la doc de tête du fichier.
   */
  revealed = false;

  /**
   * @param spawnPosition PIEDS du Directeur au spawn (x, feetY, z).
   * @param spawnForward Orientation initiale, normalisée en interne (Y ignoré).
   * @param seed Graine PRNG déterministe de cette instance — jamais dérivée de `Math.random()`/`Date.now()`.
   */
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

  /** Voir la doc identique dans `suit.ts` (`Suit.velocityHorizontal`/`Suit.knockbackVelocity`) — accès direct par cast depuis `test/game/entities/director.test.ts`, préservé au caractère près. */
  // Voir la doc identique dans `suit.ts` sur le choix de ne pas marquer ces
  // deux accesseurs `private` (`tsc --noEmit`/`noUnusedLocals` les signale
  // comme morts sinon, faute de lecture interne à la classe).
  get velocityHorizontal(): THREE.Vector3 {
    return this.ctx.velocityHorizontal;
  }
  get knockbackVelocity(): THREE.Vector3 {
    return this.ctx.knockbackVelocity;
  }

  /** Ligne d'atlas de la pose courante — voir `DIRECTOR_ATLAS_ROWS`. */
  get spriteRow(): number {
    return enemySpriteRow(this.state, this.stateTimer, this.cfg.deathFrameDuration, DIRECTOR_DEATH_FRAME_COUNT);
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

  /**
   * Applique `amount` dégâts. Retourne `{ died, justRevealed }` — voir la doc
   * de `DirectorDamageResult`. Ne touche à AUCUN système de rendu/audio/state,
   * même discipline que `Suit.applyDamage`.
   *
   * ORDRE (préservé à l'identique depuis avant ce jalon) : le garde-fou
   * `isAlive`/la soustraction de `hp` sont délégués à `applyEnemyDamageCore`
   * (`enemyMachine.ts`, cœur PARTAGÉ avec `Suit`) ; le calcul de
   * `revealed`/`justRevealed`, propre au Directeur, lit `this.hp` JUSTE
   * APRÈS cette soustraction — donc AVANT que l'action `enterDead` (côté
   * machine partagée) ne le remette à 0 en cas de coup fatal.
   */
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

  /**
   * Un pas fixe. `dt` est le dt de GAMEPLAY — jamais d'horloge murale.
   *
   * PRÉCONDITION identique à `Suit.update` : l'appelant n'appelle PAS
   * `update()` le pas fixe où ce Directeur vient d'encaisser un coup —
   * `applyDamage` gère ce pas-là (stagger/mort/révélation).
   */
  update(dt: number, ctx: DirectorUpdateContext) {
    tickEnemy(this.actor, dt, ctx);
  }
}

/**
 * Applique la configuration `DirectorConfig` à un `KinematicCharacterController`
 * brut — re-export de la fabrique PARTAGÉE (`enemyMachine.ts`), gardé sous ce
 * nom pour `DirectorManager` (inchangé par ce jalon).
 */
export function configureDirectorCharacterController(
  controller: RAPIER.KinematicCharacterController,
  cfg: DirectorConfig,
) {
  configureEnemyCharacterController(controller, cfg);
}

/**
 * Badge droppé par le Directeur à sa mort — pur objet de LOGIQUE (position +
 * rayon + état ramassé/non ramassé), AUCUNE référence à `THREE.Scene`/
 * `THREE.Object3D` ici : même séparation que `Director`/`DirectorManager`
 * vis-à-vis du rendu. Inchangé par le jalon M5 (n'a jamais fait partie de la
 * duplication Suit/Director — `Suit` n'a pas de badge).
 *
 * PAS de contrat `use_*`/`UseObject` (`game/level/interactive.ts`) : ce
 * contrat est pensé pour des objets PRÉ-AUTORISÉS dans Blender, pas pour un
 * pickup généré à RUNTIME par la mort d'une entité. Ramassage par
 * PROXIMITÉ SEULE (pas de touche E).
 */
export class DirectorBadge {
  readonly position: THREE.Vector3;
  collected = false;

  /** Secondes écoulées depuis l'apparition — voir `DirectorConfig.badgePickupDelay`. */
  private age = 0;

  constructor(position: THREE.Vector3) {
    this.position = position.clone();
  }

  /** Avance l'âge du badge d'un pas fixe — appelé par `DirectorManager.update`, jamais par une horloge murale. */
  tick(dt: number): void {
    this.age += dt;
  }

  /**
   * Un pas fixe. Retourne `true` UNE SEULE FOIS, au pas fixe où
   * `playerPosition` entre dans `pickupRadius` pour la première fois APRÈS
   * `minAge` secondes écoulées depuis le drop — les appels suivants
   * renvoient toujours `false` (déjà ramassé, encore hors de portée, ou
   * encore trop tôt). Zéro allocation.
   */
  tryCollect(playerPosition: THREE.Vector3, pickupRadius: number, minAge: number): boolean {
    if (this.collected) return false;
    if (this.age < minAge) return false;
    if (this.position.distanceToSquared(playerPosition) > pickupRadius * pickupRadius) return false;
    this.collected = true;
    return true;
  }
}
