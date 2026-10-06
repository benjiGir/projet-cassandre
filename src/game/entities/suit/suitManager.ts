import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import type { PhysicsWorld } from "../../../physics/world";
import type { HitEvent } from "../../player/weapons/weaponTypes";
import { damageForHit } from "../../player/weapons/weaponConfig";
import type { NavGraph } from "../../level/navigation/pathfindingTypes";
import type { VitreHitTarget } from "../shared/enemyTypes";
import { Suit, configureSuitCharacterController, type SuitUpdateContext } from "./suit";
import { suitConfig as defaultSuitConfig, type SuitConfig, type SuitKind } from "./suitConfig";
import { rampantConfig } from "../rampant/rampantConfig";
import { vigileConfig } from "../vigile/vigileConfig";
import { isShieldedHit } from "../shared/enemyShield";
import { NEUTRAL_ENEMY_TUNING, tuneEnemyConfig, type EnemyTuning } from "../shared/enemyTuning";

// see: docs/decisions/0010-curseur-evenements-multi-pas-fixe.md

export interface SuitAlertEvent {
  suit: Suit;
}
export interface SuitTelegraphEvent {
  suit: Suit;
}
export interface SuitShotEvent {
  suit: Suit;
}
export interface SuitHurtEvent {
  suit: Suit;
  knockbackDirection: THREE.Vector3;
}
export interface SuitDeathEvent {
  suit: Suit;
  /** `true` si ce Costard doit être remplacé par une explosion de gibs (pompe à bout portant) au lieu de l'animation de mort normale. */
  gibs: boolean;
  point: THREE.Vector3;
  direction: THREE.Vector3;
}
export interface SuitPlayerHitEvent {
  amount: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
}

interface AggregatedHit {
  totalDamage: number;
  gibs: boolean;
  gibPoint: THREE.Vector3 | null;
  gibDirection: THREE.Vector3 | null;
  /** Point de repli pour `deathEvents` quand la mort n'est PAS un gib (pas besoin d'être précis, juste non nul). */
  anyPoint: THREE.Vector3;
}

/** Graine de base + pas IMPAIR, même famille que `SHOTGUN_SPREAD_SEED` (`weapons.ts`) — jamais dérivées de `Math.random()`/`Date.now()`. */
const BASE_SUIT_SEED = 0x5eed_c057;
const SEED_STRIDE = 0x9e3779b1;

export class SuitManager {
  readonly suits: Suit[] = [];

  private readonly physics: PhysicsWorld;
  private readonly cfg: SuitConfig;
  private readonly rampantCfg: SuitConfig;
  private readonly vigileCfg: SuitConfig;
  private readonly kcc: RAPIER.KinematicCharacterController;
  private readonly colliderToSuit = new Map<number, Suit>();
  private spawnCount = 0;
  private readonly appearanceCounts: Record<SuitKind, number> = { costard: 0, rampant: 0, vigile: 0 };
  // Remis à zéro uniquement après présentation, pas entre les pas fixes.
  private hitCursor = 0;

  private readonly _alertEvents: SuitAlertEvent[] = [];
  private readonly _telegraphEvents: SuitTelegraphEvent[] = [];
  private readonly _shotEvents: SuitShotEvent[] = [];
  private readonly _hurtEvents: SuitHurtEvent[] = [];
  private readonly _deathEvents: SuitDeathEvent[] = [];
  private readonly _playerHitEvents: SuitPlayerHitEvent[] = [];
  private readonly _blockedHits = new Set<HitEvent>();

  // Scratch, zéro allocation en régime établi.
  private readonly scratchKnockback = new THREE.Vector3();
  private readonly aggregationScratch = new Map<Suit, AggregatedHit>();

  /** Part de `sightRange` à laquelle un Costard au repos repère le joueur dans CETTE partie : 1 hors effet d'un perk. */
  sightRangeScale = 1;

  /** `tuning` : PV et dégâts de CETTE partie, posés par sa difficulté sur toutes les espèces. */
  constructor(physics: PhysicsWorld, cfg: SuitConfig = defaultSuitConfig, tuning: EnemyTuning = NEUTRAL_ENEMY_TUNING) {
    this.physics = physics;
    this.cfg = tuneEnemyConfig(cfg, tuning);
    this.rampantCfg = tuneEnemyConfig(rampantConfig, tuning);
    this.vigileCfg = tuneEnemyConfig(vigileConfig, tuning);
    this.kcc = physics.world.createCharacterController(cfg.colliderOffset);
    configureSuitCharacterController(this.kcc, cfg);
  }

  get alertEvents(): ReadonlyArray<SuitAlertEvent> {
    return this._alertEvents;
  }
  get telegraphEvents(): ReadonlyArray<SuitTelegraphEvent> {
    return this._telegraphEvents;
  }
  get shotEvents(): ReadonlyArray<SuitShotEvent> {
    return this._shotEvents;
  }
  get hurtEvents(): ReadonlyArray<SuitHurtEvent> {
    return this._hurtEvents;
  }
  get deathEvents(): ReadonlyArray<SuitDeathEvent> {
    return this._deathEvents;
  }
  get playerHitEvents(): ReadonlyArray<SuitPlayerHitEvent> {
    return this._playerHitEvents;
  }
  /** Tirs du joueur arrêtés par un bouclier : aucun dégât, et le rendu les traite en impact de métal. */
  get blockedHits(): ReadonlySet<HitEvent> {
    return this._blockedHits;
  }

  clearFrameEvents() {
    this._alertEvents.length = 0;
    this._telegraphEvents.length = 0;
    this._shotEvents.length = 0;
    this._hurtEvents.length = 0;
    this._deathEvents.length = 0;
    this._playerHitEvents.length = 0;
    this._blockedHits.clear();
    this.hitCursor = 0;
  }

  // see: docs/6-reference/notes-code-gameplay-ennemis.md#état-et-horloges
  /** Configuration d'une espèce : celle du gestionnaire pour le Costard, la sienne pour les autres. */
  configFor(kind: SuitKind): SuitConfig {
    switch (kind) {
      case "costard":
        return this.cfg;
      case "rampant":
        return this.rampantCfg;
      case "vigile":
        return this.vigileCfg;
      default:
        return kind satisfies never;
    }
  }

  spawnSuit(x: number, feetY: number, z: number, facing = new THREE.Vector3(0, 0, 1), kind: SuitKind = "costard"): Suit {
    const seed = (BASE_SUIT_SEED + this.spawnCount * SEED_STRIDE) >>> 0;
    this.spawnCount++;
    const appearanceIndex = this.appearanceCounts[kind]++;
    const suit = new Suit(this.physics, new THREE.Vector3(x, feetY, z), facing, seed, this.configFor(kind), kind, appearanceIndex);
    this.suits.push(suit);
    if (suit.collider) this.colliderToSuit.set(suit.collider.handle, suit);
    return suit;
  }

  /** À appeler avant `stepPhysics`, comme `player.snapshotPrevious()`/`weapons.snapshotPrevious()`. */
  snapshotPrevious() {
    for (const suit of this.suits) suit.snapshotPrevious();
  }

  update(
    dt: number,
    playerTargetPosition: THREE.Vector3,
    playerEyePosition: THREE.Vector3,
    hitEvents: ReadonlyArray<HitEvent>,
    navGraph: NavGraph | null = null,
    vitreSystem?: VitreHitTarget,
    sanitaireSystem?: VitreHitTarget,
  ) {
    const aggregated = this.consumeNewHits(hitEvents);

    const ctx: SuitUpdateContext = {
      physics: this.physics,
      kcc: this.kcc,
      playerTargetPosition,
      playerEyePosition,
      navGraph,
      vitreSystem,
      sanitaireSystem,
    };

    for (const suit of this.suits) {
      suit.advanceAppearance(dt);
      const hit = aggregated.get(suit);
      if (hit) {
        this.applyAggregatedHit(suit, hit, playerTargetPosition);
        continue; // pas de tick de machine à états ce pas-ci : `applyDamage` a déjà positionné l'état (stagger/mort).
      }

      // Le perk VPN brouille les Costards et les Vigiles, pas l'odorat d'un Rampant.
      ctx.sightRangeScale = suit.kind === "rampant" ? 1 : this.sightRangeScale;
      suit.update(dt, ctx);
      this.drainSuitPendingEvents(suit);
    }

    aggregated.clear();
  }

  // see: docs/6-reference/notes-code-gameplay-ennemis.md#dégâts-et-événements
  debugKill(suit: Suit): boolean {
    if (!suit.isAlive) return false;
    const damage: AggregatedHit = {
      totalDamage: Number.MAX_SAFE_INTEGER,
      gibs: false,
      gibPoint: null,
      gibDirection: null,
      anyPoint: suit.position.clone(),
    };
    this.applyAggregatedHit(suit, damage, suit.position);
    return true;
  }

  /**
   * Souffle d'une explosion : dégâts selon la distance au centre, recul depuis
   * lui. `reaches` dit si le souffle atteint un point (ligne dégagée). Les
   * morts rejoignent `deathEvents`, comme celles d'un tir.
   */
  applyBlast(
    center: THREE.Vector3,
    damageAt: (distance: number) => number,
    reaches: (point: THREE.Vector3) => boolean,
    gibDistance: number,
  ): void {
    for (const suit of this.suits) {
      if (!suit.isAlive) continue;
      const distance = suit.position.distanceTo(center);
      const damage = damageAt(distance);
      if (damage <= 0 || !reaches(suit.position)) continue;
      const gibs = distance <= gibDistance;
      const away = suit.position.clone().sub(center);
      if (away.lengthSq() > 1e-8) away.normalize();
      else away.set(0, 1, 0);
      this.applyAggregatedHit(
        suit,
        {
          totalDamage: damage,
          gibs,
          gibPoint: gibs ? suit.position.clone() : null,
          gibDirection: gibs ? away : null,
          anyPoint: suit.position.clone(),
        },
        center,
      );
    }
  }

  private applyAggregatedHit(suit: Suit, hit: AggregatedHit, playerTargetPosition: THREE.Vector3) {
    this.scratchKnockback.subVectors(suit.position, playerTargetPosition);
    this.scratchKnockback.y = 0;
    const len = this.scratchKnockback.length();
    if (len > 1e-4) this.scratchKnockback.multiplyScalar(1 / len);
    else this.scratchKnockback.set(0, 0, 1);

    // Capturé AVANT `applyDamage` : la mort détache le collider (`suit.collider`
    // redevient `null`), c'est donc le seul moment où ce handle est encore lisible.
    const handleBeforeDeath = suit.collider?.handle;
    const result = suit.applyDamage(hit.totalDamage, this.physics, this.scratchKnockback);

    if (result.died) {
      if (handleBeforeDeath !== undefined) this.colliderToSuit.delete(handleBeforeDeath);
      this._deathEvents.push({
        suit,
        gibs: hit.gibs,
        point: (hit.gibs ? hit.gibPoint : null) ?? hit.anyPoint.clone(),
        direction: (hit.gibs ? hit.gibDirection : null) ?? this.scratchKnockback.clone(),
      });
    } else {
      this._hurtEvents.push({ suit, knockbackDirection: this.scratchKnockback.clone() });
    }
  }

  private drainSuitPendingEvents(suit: Suit) {
    if (suit.pendingAlert) this._alertEvents.push({ suit });
    if (suit.pendingTelegraph) this._telegraphEvents.push({ suit });
    if (suit.pendingShot) this._shotEvents.push({ suit });
    if (suit.pendingAttackDamage > 0) {
      this._playerHitEvents.push({
        amount: suit.pendingAttackDamage,
        point: suit.pendingPlayerHitPoint.clone(),
        normal: suit.pendingPlayerHitNormal.clone(),
      });
    }
  }

  private consumeNewHits(hitEvents: ReadonlyArray<HitEvent>): Map<Suit, AggregatedHit> {
    const aggregated = this.aggregationScratch;
    for (let i = this.hitCursor; i < hitEvents.length; i++) {
      const hitEvent = hitEvents[i]!;
      const suit = this.colliderToSuit.get(hitEvent.colliderHandle);
      if (!suit || !suit.isAlive) continue;
      if (isShieldedHit(suit.cfg.shield, suit.forward, hitEvent.normal)) {
        this._blockedHits.add(hitEvent);
        continue;
      }

      let entry = aggregated.get(suit);
      if (!entry) {
        entry = { totalDamage: 0, gibs: false, gibPoint: null, gibDirection: null, anyPoint: hitEvent.point.clone() };
        aggregated.set(suit, entry);
      }

      const damage = damageForHit(hitEvent);
      entry.totalDamage += damage;

      if (!entry.gibs && hitEvent.weapon === "shotgun" && hitEvent.distance <= suit.cfg.gibDistance) {
        entry.gibs = true;
        entry.gibPoint = hitEvent.point.clone();
        entry.gibDirection = hitEvent.normal.clone().negate();
      }
    }
    this.hitCursor = hitEvents.length;
    return aggregated;
  }
}
