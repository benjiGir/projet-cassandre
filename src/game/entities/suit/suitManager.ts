import * as THREE from "three";

import { BASE_SUIT_SEED } from "../../../core/effect/seeds";
import type { PhysicsWorld } from "../../../physics/world";
import type { HitEvent } from "../../player/weapons/weaponTypes";
import { rampantConfig } from "../rampant/rampantConfig";
import { controllerConfig, brigadeConfig } from "../controller/controllerConfig";
import { EnemyManager } from "../shared/enemyManager";
import { isShieldedHit } from "../shared/enemyShield";
import { NEUTRAL_ENEMY_TUNING, tuneEnemyConfig, type EnemyTuning } from "../shared/enemyTuning";
import type { EnemyUpdateContext } from "../shared/enemyTypes";
import { vigileConfig } from "../vigile/vigileConfig";
import { Suit } from "./suit";
import { suitConfig as defaultSuitConfig, type SuitConfig, type SuitKind } from "./suitConfig";

// see: docs/decisions/0010-curseur-evenements-multi-pas-fixe.md

/** Ennemis ordinaires et leurs variantes, dans un même gestionnaire. */
export class SuitManager extends EnemyManager<Suit> {
  readonly suits: Suit[] = this.enemies;

  private readonly cfg: SuitConfig;
  private readonly rampantCfg: SuitConfig;
  private readonly vigileCfg: SuitConfig;
  private readonly controllerCfg: SuitConfig;
  private readonly brigadeCfg: SuitConfig;
  private readonly appearanceCounts: Record<SuitKind, number> = {
    costard: 0,
    rampant: 0,
    vigile: 0,
    controleur: 0,
    chef_brigade: 0,
  };

  /** Part de `sightRange` à laquelle un Costard au repos repère le joueur dans CETTE partie : 1 hors effet d'un perk. */
  sightRangeScale = 1;

  /** `tuning` : PV et dégâts de CETTE partie, posés par sa difficulté sur toutes les espèces. */
  constructor(physics: PhysicsWorld, cfg: SuitConfig = defaultSuitConfig, tuning: EnemyTuning = NEUTRAL_ENEMY_TUNING) {
    super(physics, cfg, BASE_SUIT_SEED);
    this.cfg = tuneEnemyConfig(cfg, tuning);
    this.rampantCfg = tuneEnemyConfig(rampantConfig, tuning);
    this.vigileCfg = tuneEnemyConfig(vigileConfig, tuning);
    this.controllerCfg = tuneEnemyConfig(controllerConfig, tuning);
    this.brigadeCfg = tuneEnemyConfig(brigadeConfig, tuning);
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
      case "controleur":
        return this.controllerCfg;
      case "chef_brigade":
        return this.brigadeCfg;
      default:
        return kind satisfies never;
    }
  }

  spawnSuit(
    x: number,
    feetY: number,
    z: number,
    facing = new THREE.Vector3(0, 0, 1),
    kind: SuitKind = "costard",
  ): Suit {
    const seed = this.nextSeed();
    const appearanceIndex = this.appearanceCounts[kind]++;
    return this.register(
      new Suit(this.physics, new THREE.Vector3(x, feetY, z), facing, seed, this.configFor(kind), kind, appearanceIndex),
    );
  }

  protected override beforeEnemy(suit: Suit, dt: number): void {
    suit.advanceAppearance(dt);
  }

  // Le perk VPN brouille les Costards et les Vigiles, pas l'odorat d'un Rampant.
  protected override prepareContext(suit: Suit, ctx: EnemyUpdateContext): void {
    ctx.sightRangeScale = suit.kind === "rampant" ? 1 : this.sightRangeScale;
  }

  protected override blocksHit(suit: Suit, hitEvent: HitEvent): boolean {
    return isShieldedHit(suit.cfg.shield, suit.forward, hitEvent.normal);
  }

  protected override gibDistanceOf(suit: Suit): number {
    return suit.cfg.gibDistance;
  }
}
