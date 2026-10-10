import * as THREE from "three";

import { BASE_DIRECTOR_SEED } from "../../../core/effect/seeds";
import type { PhysicsWorld } from "../../../physics/world";
import { EnemyManager, type EnemyEvent } from "../shared/enemyManager";
import { NEUTRAL_ENEMY_TUNING, tuneEnemyConfig, type EnemyTuning } from "../shared/enemyTuning";
import { EventQueue, type StepEvents } from "../shared/eventQueue";
import { Director, DroppedCard } from "./director";
import { DIRECTOR_DROPPED_CARD, directorConfig as defaultDirectorConfig, type DirectorConfig } from "./directorConfig";

// see: docs/archive/systems-entites.md#les-managers-qui-pilotent-chaque-type-dennemi-suitmanager-et-directormanager

/** Le boss : en plus du lot commun, il tombe le masque et lâche une carte à sa mort. */
export class DirectorManager extends EnemyManager<Director> {
  readonly directors: Director[] = this.enemies;

  private readonly cfg: DirectorConfig;
  private readonly revealQueue = new EventQueue<EnemyEvent<Director>>();

  /** Carte lâchée par le DERNIER Directeur mort — `null` tant qu'aucun n'est mort. Voir `DroppedCard` (`director.ts`) pour la sémantique de ramassage. */
  private _droppedCard: DroppedCard | null = null;

  /** `tuning` : PV et dégâts de CETTE partie, posés par sa difficulté. */
  constructor(
    physics: PhysicsWorld,
    cfg: DirectorConfig = defaultDirectorConfig,
    tuning: EnemyTuning = NEUTRAL_ENEMY_TUNING,
  ) {
    super(physics, cfg, BASE_DIRECTOR_SEED);
    this.cfg = tuneEnemyConfig(cfg, tuning);
  }

  get reveals(): StepEvents<EnemyEvent<Director>> {
    return this.revealQueue;
  }
  get revealEvents(): ReadonlyArray<EnemyEvent<Director>> {
    return this.revealQueue.all;
  }
  /** Carte actuellement au sol (peut être déjà ramassée, voir `DroppedCard.collected`), `null` si aucun Directeur n'est encore mort. */
  get droppedCard(): DroppedCard | null {
    return this._droppedCard;
  }

  override clearFrameEvents() {
    super.clearFrameEvents();
    this.revealQueue.clear();
  }

  /** Fait apparaître un Directeur. `feetY` = hauteur des PIEDS. `facing` par défaut = +Z, normalisé en interne par `Director`. */
  spawnDirector(x: number, feetY: number, z: number, facing = new THREE.Vector3(0, 0, 1)): Director {
    return this.register(new Director(this.physics, new THREE.Vector3(x, feetY, z), facing, this.nextSeed(), this.cfg));
  }

  protected override beforeUpdate(dt: number): void {
    this._droppedCard?.tick(dt);
    this.revealQueue.beginStep();
  }

  // see: docs/6-reference/notes-code-gameplay-ennemis.md#dégâts-et-événements
  tryCollectCard(playerPosition: THREE.Vector3): boolean {
    return this._droppedCard?.tryCollect(playerPosition, this.cfg.cardPickupRadius, this.cfg.cardPickupDelay) ?? false;
  }

  protected override damage(director: Director, amount: number, knockbackDirection: THREE.Vector3): { died: boolean } {
    const result = director.applyDamage(amount, this.physics, knockbackDirection);
    if (result.justRevealed) this.revealQueue.push({ enemy: director });
    return result;
  }

  // Une seule carte suivie à la fois : cohérent avec un boss unique. Avec
  // plusieurs Directeurs, ce champ ne suivrait que le DERNIER mort.
  protected override onDeath(director: Director): void {
    const feetY = director.position.y - (this.cfg.capsuleHalfHeight + this.cfg.capsuleRadius);
    this._droppedCard = new DroppedCard(
      new THREE.Vector3(director.position.x, feetY + 0.15, director.position.z),
      DIRECTOR_DROPPED_CARD,
    );
  }
}
