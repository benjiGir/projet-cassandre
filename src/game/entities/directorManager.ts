import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import type { PhysicsWorld } from "../../physics/world";
import type { HitEvent } from "../player/weapons";
import { weaponConfig } from "../player/weaponConfig";
import {
  Director,
  DirectorBadge,
  configureDirectorCharacterController,
  type DirectorUpdateContext,
} from "./director";
import { directorConfig as defaultDirectorConfig, type DirectorConfig } from "./directorConfig";

/**
 * Manager léger pour le Directeur — même rôle et même contrat que
 * `SuitManager` (voir sa doc de tête pour le détail complet du piège de
 * consommation multi-pas-fixe de `weapons.hitEvents`/`hitCursor`, repris ici
 * à l'identique) : possède `Director[]`, boucle dessus, traduit les sorties
 * de chaque `Director.update()`/`applyDamage()` en files d'événements
 * accumulées PAR FRAME D'AFFICHAGE, lues et vidées par un futur pont
 * `main.ts` — HORS SCOPE de cette tâche de câbler ce pont (voir le rapport).
 *
 * DIFFÉRENCES DÉLIBÉRÉES avec `SuitManager` :
 *  - pas de mécanique de gibs à bout portant (hors scope de la tâche du
 *    Directeur ; un boss qui explose en morceaux casserait la mise en scène
 *    de révélation/mort) — l'agrégation de dégâts ci-dessous est donc plus
 *    simple, un seul `totalDamage` par Directeur touché ce pas-ci ;
 *  - une file d'événements supplémentaire, `revealEvents`, pour la bascule
 *    visuelle costume humain -> reptilien (voir `Director.applyDamage` /
 *    `DirectorDamageResult.justRevealed`) ;
 *  - possède le badge droppé à la mort (`DirectorBadge`, pure logique, voir
 *    sa doc dans `director.ts`) et expose `tryCollectBadge` pour qu'un futur
 *    appelant (`main.ts`) le consomme à chaque pas fixe.
 *
 * `Director[]` plutôt qu'un champ `Director | null` unique : un seul boss est
 * attendu en pratique, mais garder la forme tableau (invariant #8 : «
 * Entity[] », même architecture que `SuitManager`) coûte rien et évite un
 * type spécial pour « exactement un ennemi ».
 */

export interface DirectorAlertEvent {
  director: Director;
}
export interface DirectorTelegraphEvent {
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
  private hitCursor = 0;

  private readonly _alertEvents: DirectorAlertEvent[] = [];
  private readonly _telegraphEvents: DirectorTelegraphEvent[] = [];
  private readonly _hurtEvents: DirectorHurtEvent[] = [];
  private readonly _revealEvents: DirectorRevealEvent[] = [];
  private readonly _deathEvents: DirectorDeathEvent[] = [];
  private readonly _playerHitEvents: DirectorPlayerHitEvent[] = [];

  /** Badge droppé par le DERNIER Directeur mort — `null` tant qu'aucun n'est mort. Voir `DirectorBadge` (`director.ts`) pour la sémantique de ramassage. */
  private _badge: DirectorBadge | null = null;

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
  /** Badge actuellement droppé (peut être déjà ramassé, voir `DirectorBadge.collected`), `null` si aucun Directeur n'est encore mort. */
  get badge(): DirectorBadge | null {
    return this._badge;
  }

  /**
   * Vide toutes les files d'événements. À appeler UNE SEULE FOIS par frame
   * d'affichage, EN TOUT DERNIER — même contrat exact que
   * `SuitManager.clearFrameEvents` (voir sa doc pour la justification
   * détaillée du remise-à-zéro de `hitCursor` ICI et nulle part ailleurs).
   */
  clearFrameEvents() {
    this._alertEvents.length = 0;
    this._telegraphEvents.length = 0;
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

  /**
   * Un pas fixe. À appeler APRÈS `weapons.update(...)` — même ordre que
   * `SuitManager.update`. `hitEvents` est le MÊME tableau lu par
   * `SuitManager` (deux lecteurs indépendants, chacun avec son propre
   * `hitCursor` local et sa propre `colliderTo*` map — sûr, exactement le
   * même schéma que les lecteurs multiples de `fireEvents`/`hitEvents` dans
   * `main.ts`, voir sa doc).
   */
  update(
    dt: number,
    playerTargetPosition: THREE.Vector3,
    playerEyePosition: THREE.Vector3,
    hitEvents: ReadonlyArray<HitEvent>,
  ) {
    const aggregated = this.consumeNewHits(hitEvents);

    const ctx: DirectorUpdateContext = {
      physics: this.physics,
      kcc: this.kcc,
      playerTargetPosition,
      playerEyePosition,
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

  /**
   * Vérifie si `playerPosition` vient de ramasser le badge droppé, si un
   * Directeur est déjà mort. À appeler UNE FOIS PAR PAS FIXE par l'appelant
   * (même discipline que `InteractionSystem.update`) — HORS SCOPE de cette
   * tâche de câbler cet appel dans `main.ts` (voir le rapport de la tâche).
   */
  tryCollectBadge(playerPosition: THREE.Vector3): boolean {
    return this._badge?.tryCollect(playerPosition, this.cfg.badgePickupRadius) ?? false;
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
      // Drop du badge : position du Directeur au moment de sa mort. Un seul
      // badge suivi à la fois (`_badge`) — cohérent avec un boss unique ;
      // si un futur niveau spawnait plusieurs Directeurs, ce champ ne
      // suivrait que le DERNIER mort, choix non retravaillé ici (hors scope).
      this._badge = new DirectorBadge(director.position);
    } else {
      this._hurtEvents.push({ director, knockbackDirection: this.scratchKnockback.clone() });
    }
  }

  private drainDirectorPendingEvents(director: Director) {
    if (director.pendingAlert) this._alertEvents.push({ director });
    if (director.pendingTelegraph) this._telegraphEvents.push({ director });
    if (director.pendingAttackDamage > 0) {
      this._playerHitEvents.push({
        amount: director.pendingAttackDamage,
        point: director.pendingPlayerHitPoint.clone(),
        normal: director.pendingPlayerHitNormal.clone(),
      });
    }
  }

  /**
   * `hitCursor` est remis à 0 exclusivement par `clearFrameEvents()` — même
   * discipline que `SuitManager.consumeNewHits` (voir sa doc pour le détail
   * du bug évité).
   */
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

      const damage = hitEvent.weapon === "shotgun" ? weaponConfig.shotgunDamagePerPellet : weaponConfig.meleeDamage;
      entry.totalDamage += damage;
    }
    this.hitCursor = hitEvents.length;
    return aggregated;
  }
}
