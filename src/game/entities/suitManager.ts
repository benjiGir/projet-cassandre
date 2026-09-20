import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import type { PhysicsWorld } from "../../physics/world";
import type { HitEvent } from "../player/weapons";
import { damageForWeapon } from "../player/weaponConfig";
import type { NavGraph } from "../level/pathfinding";
import type { VitreHitTarget } from "./enemyMachine";
import { Suit, configureSuitCharacterController, type SuitUpdateContext } from "./suit";
import { suitConfig as defaultSuitConfig, type SuitConfig } from "./suitConfig";

/**
 * Manager léger : possède `Suit[]`, boucle dessus, traduit les sorties de
 * chaque `Suit.update()` en files d'événements accumulées PAR FRAME
 * D'AFFICHAGE, vidées UNE SEULE FOIS par `clearFrameEvents()` — conforme à
 * l'invariant #8. Propriétaire du `KinematicCharacterController` PARTAGÉ
 * (une seule instance pour tous les Costards).
 *
 * `hitCursor` (voir `consumeNewHits`) ne relit jamais un impact déjà vu
 * malgré un `weapons.hitEvents` qui accumule sur PLUSIEURS pas fixes d'une
 * même frame — remis à 0 UNIQUEMENT par `clearFrameEvents()`, jamais inféré.
 * see: docs/decisions/0010-curseur-evenements-multi-pas-fixe.md
 * see: docs/systems/entites.md#les-managers-qui-pilotent-chaque-type-dennemi-suitmanager-et-directormanager
 */

export interface SuitAlertEvent {
  suit: Suit;
}
export interface SuitTelegraphEvent {
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
  private readonly kcc: RAPIER.KinematicCharacterController;
  private readonly colliderToSuit = new Map<number, Suit>();
  private spawnCount = 0;
  private hitCursor = 0;

  private readonly _alertEvents: SuitAlertEvent[] = [];
  private readonly _telegraphEvents: SuitTelegraphEvent[] = [];
  private readonly _hurtEvents: SuitHurtEvent[] = [];
  private readonly _deathEvents: SuitDeathEvent[] = [];
  private readonly _playerHitEvents: SuitPlayerHitEvent[] = [];

  // Scratch, zéro allocation en régime établi.
  private readonly scratchKnockback = new THREE.Vector3();
  private readonly aggregationScratch = new Map<Suit, AggregatedHit>();

  constructor(physics: PhysicsWorld, cfg: SuitConfig = defaultSuitConfig) {
    this.physics = physics;
    this.cfg = cfg;
    this.kcc = physics.world.createCharacterController(cfg.colliderOffset);
    configureSuitCharacterController(this.kcc, cfg);
  }

  get alertEvents(): ReadonlyArray<SuitAlertEvent> {
    return this._alertEvents;
  }
  get telegraphEvents(): ReadonlyArray<SuitTelegraphEvent> {
    return this._telegraphEvents;
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

  /**
   * Vide toutes les files d'événements. À appeler UNE SEULE FOIS par frame
   * d'affichage, EN TOUT DERNIER dans `updateFx` (même règle que
   * `weapons.clearFrameEvents()`), après que tous les lecteurs (sprites, fx,
   * audio, store) ont fini de lire cette frame.
   *
   * C'est aussi ici, et SEULEMENT ici, que `hitCursor` retombe à 0 (voir
   * `consumeNewHits` et l'en-tête du fichier) — jamais inféré par
   * comparaison de longueur.
   * see: docs/decisions/0010-curseur-evenements-multi-pas-fixe.md
   */
  clearFrameEvents() {
    this._alertEvents.length = 0;
    this._telegraphEvents.length = 0;
    this._hurtEvents.length = 0;
    this._deathEvents.length = 0;
    this._playerHitEvents.length = 0;
    this.hitCursor = 0;
  }

  /**
   * Fait apparaître un Costard. `feetY` = hauteur des PIEDS (même convention
   * que `PlayerController.spawn`). `facing` par défaut = +Z, normalisé en
   * interne par `Suit`.
   */
  spawnSuit(x: number, feetY: number, z: number, facing = new THREE.Vector3(0, 0, 1)): Suit {
    const seed = (BASE_SUIT_SEED + this.spawnCount * SEED_STRIDE) >>> 0;
    this.spawnCount++;
    const suit = new Suit(this.physics, new THREE.Vector3(x, feetY, z), facing, seed, this.cfg);
    this.suits.push(suit);
    if (suit.collider) this.colliderToSuit.set(suit.collider.handle, suit);
    return suit;
  }

  /** À appeler avant `stepPhysics`, comme `player.snapshotPrevious()`/`weapons.snapshotPrevious()`. */
  snapshotPrevious() {
    for (const suit of this.suits) suit.snapshotPrevious();
  }

  /**
   * Un pas fixe. À appeler APRÈS `weapons.update(...)` (pour que
   * `hitEvents` du pas courant existent déjà) — voir `game/loop/updateGameplay.ts`.
   *
   * `playerTargetPosition`/`playerEyePosition` : origines AUTHENTIQUES du pas
   * fixe courant (jamais interpolées pour le rendu), même discipline que
   * `WeaponSystem.update`.
   *
   * `navGraph` (jalon M4, PLAN_EFFECT_XSTATE.md) : graphe de praticabilité
   * du niveau COURANT (`session.currentNavGraph`), `null` tant qu'aucun bake
   * n'a encore eu lieu — rebaké dans le callback `onLoaded` de
   * `createLevelSession` (voir `game/session/spawning.ts::loadGltfLevel`).
   * Simplement transmis à chaque `Suit` via `SuitUpdateContext`, ce manager
   * ne l'interprète jamais lui-même.
   */
  update(
    dt: number,
    playerTargetPosition: THREE.Vector3,
    playerEyePosition: THREE.Vector3,
    hitEvents: ReadonlyArray<HitEvent>,
    navGraph: NavGraph | null = null,
    vitreSystem?: VitreHitTarget,
  ) {
    const aggregated = this.consumeNewHits(hitEvents);

    const ctx: SuitUpdateContext = {
      physics: this.physics,
      kcc: this.kcc,
      playerTargetPosition,
      playerEyePosition,
      navGraph,
      vitreSystem,
    };

    for (const suit of this.suits) {
      const hit = aggregated.get(suit);
      if (hit) {
        this.applyAggregatedHit(suit, hit, playerTargetPosition);
        continue; // pas de tick de machine à états ce pas-ci : `applyDamage` a déjà positionné l'état (stagger/mort).
      }

      suit.update(dt, ctx);
      this.drainSuitPendingEvents(suit);
    }

    aggregated.clear();
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
      // Retire le mapping IMMÉDIATEMENT : Rapier peut recycler un handle de
      // collider supprimé pour un futur `createCollider` (un nouveau Costard
      // spawné via `cassandre.spawnSuit`). Sans ce retrait, un tir touchant
      // ce nouveau collider router ait par erreur vers CE Costard mort.
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
    if (suit.pendingAttackDamage > 0) {
      this._playerHitEvents.push({
        amount: suit.pendingAttackDamage,
        point: suit.pendingPlayerHitPoint.clone(),
        normal: suit.pendingPlayerHitNormal.clone(),
      });
    }
  }

  /**
   * `hitCursor` est remis à 0 exclusivement par `clearFrameEvents()` — jamais
   * ici. Ne PAS réintroduire de comparaison de longueur pour « deviner » une
   * nouvelle frame.
   * see: docs/decisions/0010-curseur-evenements-multi-pas-fixe.md
   */
  private consumeNewHits(hitEvents: ReadonlyArray<HitEvent>): Map<Suit, AggregatedHit> {
    const aggregated = this.aggregationScratch;
    for (let i = this.hitCursor; i < hitEvents.length; i++) {
      const hitEvent = hitEvents[i]!;
      const suit = this.colliderToSuit.get(hitEvent.colliderHandle);
      if (!suit || !suit.isAlive) continue;

      let entry = aggregated.get(suit);
      if (!entry) {
        entry = { totalDamage: 0, gibs: false, gibPoint: null, gibDirection: null, anyPoint: hitEvent.point.clone() };
        aggregated.set(suit, entry);
      }

      const damage = damageForWeapon(hitEvent.weapon);
      entry.totalDamage += damage;

      if (!entry.gibs && hitEvent.weapon === "shotgun" && hitEvent.distance <= this.cfg.gibDistance) {
        entry.gibs = true;
        entry.gibPoint = hitEvent.point.clone();
        // Approximation de la direction du coup fatal : la normale de
        // surface pointe globalement VERS le tireur, donc son inverse
        // approxime la trajectoire du plomb — voir la doc de `HitEvent` dans
        // `weapons.ts` (la normale du pompe vient de `castRayAndGetNormal`,
        // une vraie normale de surface, pas une approximation comme pour le
        // pied-de-biche). `fx.spawnGibs` ne demande qu'une direction DE BASE
        // pour la dispersion, pas une trajectoire exacte.
        entry.gibDirection = hitEvent.normal.clone().negate();
      }
    }
    this.hitCursor = hitEvents.length;
    return aggregated;
  }
}
