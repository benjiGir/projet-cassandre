import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import type { PhysicsWorld } from "../../physics/world";
import type { HitEvent } from "../player/weaponTypes";
import { damageForWeapon } from "../player/weaponConfig";
import type { NavGraph } from "../level/pathfindingTypes";
import type { VitreHitTarget } from "./enemyTypes";
import {
  Director,
  DroppedCard,
  configureDirectorCharacterController,
  type DirectorUpdateContext,
} from "./director";
import {
  DIRECTOR_DROPPED_CARD,
  directorConfig as defaultDirectorConfig,
  type DirectorConfig,
} from "./directorConfig";

// see: docs/archive/systems-entites.md#les-managers-qui-pilotent-chaque-type-dennemi-suitmanager-et-directormanager

export interface DirectorAlertEvent {
  director: Director;
}
export interface DirectorTelegraphEvent {
  director: Director;
}
export interface DirectorShotEvent {
  director: Director;
}
export interface DirectorHurtEvent {
  director: Director;
  knockbackDirection: THREE.Vector3;
}
export interface DirectorRevealEvent {
  director: Director;
}
export interface DirectorDeathEvent {
  director: Director;
  point: THREE.Vector3;
  direction: THREE.Vector3;
}
export interface DirectorPlayerHitEvent {
  amount: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
}

interface AggregatedHit {
  totalDamage: number;
  anyPoint: THREE.Vector3;
}

/** Graine de base + pas IMPAIR, même famille que `BASE_SUIT_SEED` (`suitManager.ts`) — jamais dérivées de `Math.random()`/`Date.now()`. Valeur DISTINCTE de celle du Costard : deux types d'ennemis ne doivent jamais partager une même séquence PRNG, même par coïncidence. */
const BASE_DIRECTOR_SEED = 0xd12ec704;
const SEED_STRIDE = 0x9e3779b1;

export class DirectorManager {
  readonly directors: Director[] = [];

  private readonly physics: PhysicsWorld;
  private readonly cfg: DirectorConfig;
  private readonly kcc: RAPIER.KinematicCharacterController;
  private readonly colliderToDirector = new Map<number, Director>();
  private spawnCount = 0;
  // Remis à zéro uniquement après présentation, pas entre les pas fixes.
  private hitCursor = 0;

  private readonly _alertEvents: DirectorAlertEvent[] = [];
  private readonly _telegraphEvents: DirectorTelegraphEvent[] = [];
  private readonly _shotEvents: DirectorShotEvent[] = [];
  private readonly _hurtEvents: DirectorHurtEvent[] = [];
  private readonly _revealEvents: DirectorRevealEvent[] = [];
  private readonly _deathEvents: DirectorDeathEvent[] = [];
  private readonly _playerHitEvents: DirectorPlayerHitEvent[] = [];

  /** Carte lâchée par le DERNIER Directeur mort — `null` tant qu'aucun n'est mort. Voir `DroppedCard` (`director.ts`) pour la sémantique de ramassage. */
  private _droppedCard: DroppedCard | null = null;

  // Scratch, zéro allocation en régime établi.
  private readonly scratchKnockback = new THREE.Vector3();
  private readonly aggregationScratch = new Map<Director, AggregatedHit>();

  constructor(physics: PhysicsWorld, cfg: DirectorConfig = defaultDirectorConfig) {
    this.physics = physics;
    this.cfg = cfg;
    this.kcc = physics.world.createCharacterController(cfg.colliderOffset);
    configureDirectorCharacterController(this.kcc, cfg);
  }

  get alertEvents(): ReadonlyArray<DirectorAlertEvent> {
    return this._alertEvents;
  }
  get telegraphEvents(): ReadonlyArray<DirectorTelegraphEvent> {
    return this._telegraphEvents;
  }
  get shotEvents(): ReadonlyArray<DirectorShotEvent> {
    return this._shotEvents;
  }
  get hurtEvents(): ReadonlyArray<DirectorHurtEvent> {
    return this._hurtEvents;
  }
  get revealEvents(): ReadonlyArray<DirectorRevealEvent> {
    return this._revealEvents;
  }
  get deathEvents(): ReadonlyArray<DirectorDeathEvent> {
    return this._deathEvents;
  }
  get playerHitEvents(): ReadonlyArray<DirectorPlayerHitEvent> {
    return this._playerHitEvents;
  }
  /** Carte actuellement au sol (peut être déjà ramassé, voir `DroppedCard.collected`), `null` si aucun Directeur n'est encore mort. */
  get droppedCard(): DroppedCard | null {
    return this._droppedCard;
  }

  // see: docs/6-reference/notes-code-gameplay-ennemis.md#état-et-horloges
  clearFrameEvents() {
    this._alertEvents.length = 0;
    this._telegraphEvents.length = 0;
    this._shotEvents.length = 0;
    this._hurtEvents.length = 0;
    this._revealEvents.length = 0;
    this._deathEvents.length = 0;
    this._playerHitEvents.length = 0;
    this.hitCursor = 0;
  }

  /** Fait apparaître un Directeur. `feetY` = hauteur des PIEDS. `facing` par défaut = +Z, normalisé en interne par `Director`. */
  spawnDirector(x: number, feetY: number, z: number, facing = new THREE.Vector3(0, 0, 1)): Director {
    const seed = (BASE_DIRECTOR_SEED + this.spawnCount * SEED_STRIDE) >>> 0;
    this.spawnCount++;
    const director = new Director(this.physics, new THREE.Vector3(x, feetY, z), facing, seed, this.cfg);
    this.directors.push(director);
    if (director.collider) this.colliderToDirector.set(director.collider.handle, director);
    return director;
  }

  /** À appeler avant `stepPhysics`, comme `SuitManager.snapshotPrevious`. */
  snapshotPrevious() {
    for (const director of this.directors) director.snapshotPrevious();
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
    this._droppedCard?.tick(dt);

    const aggregated = this.consumeNewHits(hitEvents);

    const ctx: DirectorUpdateContext = {
      physics: this.physics,
      kcc: this.kcc,
      playerTargetPosition,
      playerEyePosition,
      navGraph,
      vitreSystem,
      sanitaireSystem,
    };

    for (const director of this.directors) {
      const hit = aggregated.get(director);
      if (hit) {
        this.applyAggregatedHit(director, hit, playerTargetPosition);
        continue; // pas de tick de machine à états ce pas-ci : `applyDamage` a déjà positionné l'état.
      }

      director.update(dt, ctx);
      this.drainDirectorPendingEvents(director);
    }

    aggregated.clear();
  }

  // see: docs/6-reference/notes-code-gameplay-ennemis.md#dégâts-et-événements
  tryCollectCard(playerPosition: THREE.Vector3): boolean {
    return this._droppedCard?.tryCollect(playerPosition, this.cfg.cardPickupRadius, this.cfg.cardPickupDelay) ?? false;
  }

  debugKill(director: Director): boolean {
    if (!director.isAlive) return false;
    const damage: AggregatedHit = { totalDamage: Number.MAX_SAFE_INTEGER, anyPoint: director.position.clone() };
    this.applyAggregatedHit(director, damage, director.position);
    return true;
  }

  private applyAggregatedHit(director: Director, hit: AggregatedHit, playerTargetPosition: THREE.Vector3) {
    this.scratchKnockback.subVectors(director.position, playerTargetPosition);
    this.scratchKnockback.y = 0;
    const len = this.scratchKnockback.length();
    if (len > 1e-4) this.scratchKnockback.multiplyScalar(1 / len);
    else this.scratchKnockback.set(0, 0, 1);

    const handleBeforeDeath = director.collider?.handle;
    const result = director.applyDamage(hit.totalDamage, this.physics, this.scratchKnockback);

    if (result.justRevealed) {
      this._revealEvents.push({ director });
    }

    if (result.died) {
      // Retire le mapping IMMÉDIATEMENT — même raison que `SuitManager.applyAggregatedHit`
      // (un handle de collider supprimé peut être recyclé par Rapier).
      if (handleBeforeDeath !== undefined) this.colliderToDirector.delete(handleBeforeDeath);
      this._deathEvents.push({
        director,
        point: hit.anyPoint.clone(),
        direction: this.scratchKnockback.clone(),
      });
      const feetY = director.position.y - (this.cfg.capsuleHalfHeight + this.cfg.capsuleRadius);
      // Une seule carte suivie à la fois (`_droppedCard`) — cohérent avec un
      // boss unique ; si un futur niveau spawnait plusieurs Directeurs, ce
      // champ ne suivrait que le DERNIER mort, choix non retravaillé ici.
      this._droppedCard = new DroppedCard(
        new THREE.Vector3(director.position.x, feetY + 0.15, director.position.z),
        DIRECTOR_DROPPED_CARD,
      );
    } else {
      this._hurtEvents.push({ director, knockbackDirection: this.scratchKnockback.clone() });
    }
  }

  private drainDirectorPendingEvents(director: Director) {
    if (director.pendingAlert) this._alertEvents.push({ director });
    if (director.pendingTelegraph) this._telegraphEvents.push({ director });
    if (director.pendingShot) this._shotEvents.push({ director });
    if (director.pendingAttackDamage > 0) {
      this._playerHitEvents.push({
        amount: director.pendingAttackDamage,
        point: director.pendingPlayerHitPoint.clone(),
        normal: director.pendingPlayerHitNormal.clone(),
      });
    }
  }

  private consumeNewHits(hitEvents: ReadonlyArray<HitEvent>): Map<Director, AggregatedHit> {
    const aggregated = this.aggregationScratch;
    for (let i = this.hitCursor; i < hitEvents.length; i++) {
      const hitEvent = hitEvents[i]!;
      const director = this.colliderToDirector.get(hitEvent.colliderHandle);
      if (!director || !director.isAlive) continue;

      let entry = aggregated.get(director);
      if (!entry) {
        entry = { totalDamage: 0, anyPoint: hitEvent.point.clone() };
        aggregated.set(director, entry);
      }

      const damage = damageForWeapon(hitEvent.weapon);
      entry.totalDamage += damage;
    }
    this.hitCursor = hitEvents.length;
    return aggregated;
  }
}
