import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

import { SEED_STRIDE } from "../../../core/effect/seeds";
import type { PhysicsWorld } from "../../../physics/world";
import type { NavGraph } from "../../level/navigation/pathfindingTypes";
import { damageForHit } from "../../player/weapons/weaponConfig";
import type { HitEvent } from "../../player/weapons/weaponTypes";
import type { EnemyEntity, EntityConfig } from "./enemyEntity";
import { configureEnemyCharacterController } from "./enemyPhysics";
import type { EnemyConfig, EnemyUpdateContext, VitreHitTarget } from "./enemyTypes";
import { EventQueue, type StepEvents } from "./eventQueue";
import { EnemyCorpses, type CorpseBurstEvent } from "./enemyCorpses";

export interface EnemyEvent<TEnemy> {
  enemy: TEnemy;
}
export interface EnemyHurtEvent<TEnemy> {
  enemy: TEnemy;
  knockbackDirection: THREE.Vector3;
}
export interface EnemyDeathEvent<TEnemy> {
  enemy: TEnemy;
  /** `true` si le corps doit être remplacé par une explosion de gibs au lieu de l'animation de mort. */
  gibs: boolean;
  point: THREE.Vector3;
  direction: THREE.Vector3;
}
export interface EnemyPlayerHitEvent {
  amount: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  push?: { displacement: THREE.Vector3; duration: number };
}

/** Dégâts reçus par UN ennemi sur un pas fixe : plusieurs plombs ne font qu'un coup. */
interface AggregatedHit {
  totalDamage: number;
  gibs: boolean;
  gibPoint: THREE.Vector3 | null;
  gibDirection: THREE.Vector3 | null;
  /** Point de repli pour `deathEvents` quand la mort n'est PAS un gib (pas besoin d'être précis, juste non nul). */
  anyPoint: THREE.Vector3;
  interruptCharge?: boolean;
}

// Ce que tout gestionnaire d'ennemis fait à chaque pas fixe : regrouper les
// impacts du joueur par ennemi, faire tourner chaque machine, et ranger ce qui
// s'est passé dans des files que la présentation lira une fois par image.
// see: docs/archive/systems-entites.md#les-managers-qui-pilotent-chaque-type-dennemi-suitmanager-et-directormanager
export abstract class EnemyManager<TEnemy extends EnemyEntity<EntityConfig>> {
  protected readonly enemies: TEnemy[] = [];
  protected readonly physics: PhysicsWorld;
  private readonly kcc: RAPIER.KinematicCharacterController;
  private readonly enemyByCollider = new Map<number, TEnemy>();
  private readonly corpses: EnemyCorpses<TEnemy>;
  private spawnCount = 0;
  canChargeTo?: (position: THREE.Vector3) => boolean;
  // Remis à zéro uniquement après présentation, pas entre les pas fixes.
  private hitCursor = 0;

  private readonly alertQueue = new EventQueue<EnemyEvent<TEnemy>>();
  private readonly telegraphQueue = new EventQueue<EnemyEvent<TEnemy>>();
  private readonly shotQueue = new EventQueue<EnemyEvent<TEnemy>>();
  private readonly hurtQueue = new EventQueue<EnemyHurtEvent<TEnemy>>();
  private readonly deathQueue = new EventQueue<EnemyDeathEvent<TEnemy>>();
  private readonly playerHitQueue = new EventQueue<EnemyPlayerHitEvent>();
  private readonly _blockedHits = new Set<HitEvent>();

  // Scratch, zéro allocation en régime établi.
  private readonly scratchKnockback = new THREE.Vector3();
  private readonly aggregationScratch = new Map<TEnemy, AggregatedHit>();

  /** `controllerConfig` : gabarit du character controller partagé par tous les ennemis de ce gestionnaire. */
  constructor(
    physics: PhysicsWorld,
    controllerConfig: EnemyConfig,
    private readonly baseSeed: number,
  ) {
    this.physics = physics;
    this.corpses = new EnemyCorpses(physics);
    this.kcc = physics.world.createCharacterController(controllerConfig.colliderOffset);
    configureEnemyCharacterController(this.kcc, controllerConfig);
  }

  /** Files lues au pas fixe : `stepCount`/`stepAt` ne voient que ce que le dernier `update` a émis. */
  get alerts(): StepEvents<EnemyEvent<TEnemy>> {
    return this.alertQueue;
  }
  get telegraphs(): StepEvents<EnemyEvent<TEnemy>> {
    return this.telegraphQueue;
  }
  get shots(): StepEvents<EnemyEvent<TEnemy>> {
    return this.shotQueue;
  }
  get deaths(): StepEvents<EnemyDeathEvent<TEnemy>> {
    return this.deathQueue;
  }
  get playerHits(): StepEvents<EnemyPlayerHitEvent> {
    return this.playerHitQueue;
  }

  /** Files lues par la présentation, une fois par image : tout ce qui s'est accumulé depuis `clearFrameEvents`. */
  get alertEvents(): ReadonlyArray<EnemyEvent<TEnemy>> {
    return this.alertQueue.all;
  }
  get telegraphEvents(): ReadonlyArray<EnemyEvent<TEnemy>> {
    return this.telegraphQueue.all;
  }
  get shotEvents(): ReadonlyArray<EnemyEvent<TEnemy>> {
    return this.shotQueue.all;
  }
  get hurtEvents(): ReadonlyArray<EnemyHurtEvent<TEnemy>> {
    return this.hurtQueue.all;
  }
  get deathEvents(): ReadonlyArray<EnemyDeathEvent<TEnemy>> {
    return this.deathQueue.all;
  }
  get playerHitEvents(): ReadonlyArray<EnemyPlayerHitEvent> {
    return this.playerHitQueue.all;
  }
  /** Tirs du joueur arrêtés par un bouclier : aucun dégât, et le rendu les traite en impact de métal. */
  get blockedHits(): ReadonlySet<HitEvent> {
    return this._blockedHits;
  }

  get corpseBurstEvents(): readonly CorpseBurstEvent[] {
    return this.corpses.burstEvents;
  }

  isCorpseCollider(handle: number): boolean {
    return this.corpses.hasCollider(handle);
  }

  // see: docs/6-reference/notes-code-gameplay-ennemis.md#état-et-horloges
  clearFrameEvents() {
    this.alertQueue.clear();
    this.telegraphQueue.clear();
    this.shotQueue.clear();
    this.hurtQueue.clear();
    this.deathQueue.clear();
    this.playerHitQueue.clear();
    this._blockedHits.clear();
    this.corpses.clearFrameEvents();
    this.hitCursor = 0;
  }

  /** Graine de la prochaine apparition : une suite propre à ce gestionnaire, dans l'ordre des apparitions. */
  protected nextSeed(): number {
    const seed = (this.baseSeed + this.spawnCount * SEED_STRIDE) >>> 0;
    this.spawnCount++;
    return seed;
  }

  protected register(enemy: TEnemy): TEnemy {
    this.enemies.push(enemy);
    if (enemy.collider) this.enemyByCollider.set(enemy.collider.handle, enemy);
    return enemy;
  }

  /** À appeler avant `stepPhysics`, comme `player.snapshotPrevious()`/`weapons.snapshotPrevious()`. */
  snapshotPrevious() {
    for (const enemy of this.enemies) enemy.snapshotPrevious();
  }

  // see: docs/6-reference/notes-code-gameplay-ennemis.md#déplacement-et-combat
  update(
    dt: number,
    playerTargetPosition: THREE.Vector3,
    playerEyePosition: THREE.Vector3,
    hitEvents: ReadonlyArray<HitEvent>,
    navGraph: NavGraph | null = null,
    vitreSystem?: VitreHitTarget,
    sanitaireSystem?: VitreHitTarget,
  ) {
    this.beforeUpdate(dt);
    this.alertQueue.beginStep();
    this.telegraphQueue.beginStep();
    this.shotQueue.beginStep();
    this.hurtQueue.beginStep();
    this.deathQueue.beginStep();
    this.playerHitQueue.beginStep();

    const aggregated = this.consumeNewHits(hitEvents);

    const ctx: EnemyUpdateContext = {
      physics: this.physics,
      kcc: this.kcc,
      playerTargetPosition,
      playerEyePosition,
      navGraph,
      vitreSystem,
      sanitaireSystem,
      canChargeTo: this.canChargeTo,
    };

    for (const enemy of this.enemies) {
      this.beforeEnemy(enemy, dt);
      const hit = aggregated.get(enemy);
      if (hit) {
        this.applyAggregatedHit(enemy, hit, playerTargetPosition);
        if (!enemy.cfg.charge || !enemy.isAlive || enemy.state === "stagger") continue;
      }

      this.prepareContext(enemy, ctx);
      enemy.update(dt, ctx);
      this.drainPendingEvents(enemy);
      if (enemy.state === "corpse") this.corpses.register(enemy);
    }

    aggregated.clear();
  }

  // see: docs/6-reference/notes-code-gameplay-ennemis.md#dégâts-et-événements
  debugKill(enemy: TEnemy): boolean {
    if (!enemy.isAlive) return false;
    const damage: AggregatedHit = {
      totalDamage: Number.MAX_SAFE_INTEGER,
      gibs: false,
      gibPoint: null,
      gibDirection: null,
      anyPoint: enemy.position.clone(),
    };
    this.applyAggregatedHit(enemy, damage, enemy.position);
    return true;
  }

  /**
   * Souffle d'une explosion : dégâts selon la distance au centre, recul depuis
   * lui. `reaches` dit si le souffle atteint un point (ligne dégagée). Les
   * morts rejoignent `deathEvents`, comme celles d'un tir. Sans `gibDistance`,
   * aucun démembrement.
   */
  applyBlast(
    center: THREE.Vector3,
    damageAt: (distance: number) => number,
    reaches: (point: THREE.Vector3) => boolean,
    gibDistance = -Infinity,
  ): void {
    this.corpses.applyBlast(center, damageAt, reaches);
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const distance = enemy.position.distanceTo(center);
      const damage = damageAt(distance);
      if (damage <= 0 || !reaches(enemy.position)) continue;
      const gibs = distance <= gibDistance;
      const away = enemy.position.clone().sub(center);
      if (away.lengthSq() > 1e-8) away.normalize();
      else away.set(0, 1, 0);
      this.applyAggregatedHit(
        enemy,
        {
          totalDamage: damage,
          gibs,
          gibPoint: gibs ? enemy.position.clone() : null,
          gibDirection: gibs ? away : null,
          anyPoint: enemy.position.clone(),
        },
        center,
      );
    }
  }

  /** Début du pas fixe, avant la lecture des impacts. */
  protected beforeUpdate(_dt: number): void {}

  /** Avant tout traitement d'un ennemi à ce pas, touché ou non. */
  protected beforeEnemy(_enemy: TEnemy, _dt: number): void {}

  /** Ce que le contexte de mise à jour a de propre à cet ennemi. */
  protected prepareContext(_enemy: TEnemy, _ctx: EnemyUpdateContext): void {}

  /** Un tir arrêté avant d'atteindre l'ennemi : ni dégât, ni recul. */
  protected blocksHit(_enemy: TEnemy, _hitEvent: HitEvent): boolean {
    return false;
  }

  /** Distance sous laquelle un coup de pompe démembre ; `-Infinity` : jamais. */
  protected gibDistanceOf(_enemy: TEnemy): number {
    return -Infinity;
  }

  protected damage(
    enemy: TEnemy,
    amount: number,
    knockbackDirection: THREE.Vector3,
    interruptCharge = true,
  ): { died: boolean } {
    return enemy.applyDamage(amount, this.physics, knockbackDirection, interruptCharge);
  }

  protected onDeath(_enemy: TEnemy): void {}

  private applyAggregatedHit(enemy: TEnemy, hit: AggregatedHit, playerTargetPosition: THREE.Vector3) {
    this.scratchKnockback.subVectors(enemy.position, playerTargetPosition);
    this.scratchKnockback.y = 0;
    const len = this.scratchKnockback.length();
    if (len > 1e-4) this.scratchKnockback.multiplyScalar(1 / len);
    else this.scratchKnockback.set(0, 0, 1);

    // Capturé AVANT les dégâts : la mort détache le collider (`enemy.collider`
    // redevient `null`), c'est donc le seul moment où ce handle est encore lisible.
    const handleBeforeDeath = enemy.collider?.handle;
    const result = this.damage(enemy, hit.totalDamage, this.scratchKnockback, hit.interruptCharge ?? true);

    if (result.died) {
      enemy.hasRemains = !hit.gibs;
      // Retiré tout de suite : Rapier peut recycler le handle d'un collider supprimé.
      if (handleBeforeDeath !== undefined) this.enemyByCollider.delete(handleBeforeDeath);
      this.deathQueue.push({
        enemy,
        gibs: hit.gibs,
        point: (hit.gibs ? hit.gibPoint : null) ?? hit.anyPoint.clone(),
        direction: (hit.gibs ? hit.gibDirection : null) ?? this.scratchKnockback.clone(),
      });
      this.onDeath(enemy);
    } else {
      this.hurtQueue.push({ enemy, knockbackDirection: this.scratchKnockback.clone() });
    }
  }

  private drainPendingEvents(enemy: TEnemy) {
    if (enemy.pendingAlert) this.alertQueue.push({ enemy });
    if (enemy.pendingTelegraph) this.telegraphQueue.push({ enemy });
    if (enemy.pendingShot) this.shotQueue.push({ enemy });
    if (enemy.pendingAttackDamage > 0) {
      this.playerHitQueue.push({
        amount: enemy.pendingAttackDamage,
        point: enemy.pendingPlayerHitPoint.clone(),
        normal: enemy.pendingPlayerHitNormal.clone(),
        push:
          enemy.pendingPushDuration > 0
            ? { displacement: enemy.pendingPlayerPush.clone(), duration: enemy.pendingPushDuration }
            : undefined,
      });
    }
  }

  private consumeNewHits(hitEvents: ReadonlyArray<HitEvent>): Map<TEnemy, AggregatedHit> {
    const aggregated = this.aggregationScratch;
    for (let i = this.hitCursor; i < hitEvents.length; i++) {
      const hitEvent = hitEvents[i];
      if (this.corpses.applyHit(hitEvent)) continue;
      const enemy = this.enemyByCollider.get(hitEvent.colliderHandle);
      if (!enemy || !enemy.isAlive) continue;
      if (this.blocksHit(enemy, hitEvent)) {
        this._blockedHits.add(hitEvent);
        continue;
      }

      let entry = aggregated.get(enemy);
      if (!entry) {
        entry = { totalDamage: 0, gibs: false, gibPoint: null, gibDirection: null, anyPoint: hitEvent.point.clone() };
        aggregated.set(enemy, entry);
      }

      entry.totalDamage += damageForHit(hitEvent);
      if (enemy.cfg.charge) {
        entry.interruptCharge =
          (entry.interruptCharge ?? false) ||
          (hitEvent.weapon === "shotgun" && hitEvent.distance <= enemy.cfg.charge.interruptRange);
      }

      if (!entry.gibs && hitEvent.weapon === "shotgun" && hitEvent.distance <= this.gibDistanceOf(enemy)) {
        entry.gibs = true;
        entry.gibPoint = hitEvent.point.clone();
        entry.gibDirection = hitEvent.normal.clone().negate();
      }
    }
    this.hitCursor = hitEvents.length;
    return aggregated;
  }
}
