import type * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

import type { PhysicsWorld } from "../../../physics/world";
import { EnemyEntity } from "../shared/enemyEntity";
import { configureEnemyCharacterController } from "../shared/enemyPhysics";
import { ENEMY_MATERIALIZATION_DURATION } from "../shared/enemySpawnConfig";
import type { EnemyState, EnemyUpdateContext } from "../shared/enemyTypes";
import { suitConfig as defaultSuitConfig, type SuitConfig, type SuitKind } from "./suitConfig";

// see: docs/archive/systems-entites.md#suit-et-director-deux-fines-couches-au-dessus-de-la-machine-partagée

// see: docs/6-reference/notes-code-gameplay-ennemis.md#dégâts-et-événements
export const DEATH_FRAME_COUNT = 6;

export type SuitState = EnemyState;

// see: docs/6-reference/notes-code-gameplay-ennemis.md#état-et-horloges
export type SuitUpdateContext = EnemyUpdateContext;

/** Ennemis ordinaires : une machine commune, une config et une planche par espèce. */
export class Suit extends EnemyEntity<SuitConfig> {
  /** Espèce : décide de la planche de sprites, des sons et des répliques — jamais du code de la machine. */
  readonly kind: SuitKind;
  readonly appearanceIndex: number;
  private appearanceRemaining = 0;
  private alertRequested = false;

  constructor(
    physics: PhysicsWorld,
    spawnPosition: THREE.Vector3,
    spawnForward: THREE.Vector3,
    seed: number,
    cfg: SuitConfig = defaultSuitConfig,
    kind: SuitKind = "costard",
    appearanceIndex = 0,
  ) {
    super(physics, spawnPosition, spawnForward, seed, cfg, DEATH_FRAME_COUNT);
    this.kind = kind;
    this.appearanceIndex = appearanceIndex;
  }

  alertPlayer(): void {
    this.alertRequested = true;
  }

  get appearanceProgress(): number {
    return 1 - this.appearanceRemaining / ENEMY_MATERIALIZATION_DURATION;
  }

  beginAppearance(): void {
    this.appearanceRemaining = ENEMY_MATERIALIZATION_DURATION;
  }

  advanceAppearance(dt: number): void {
    this.appearanceRemaining = Math.max(0, this.appearanceRemaining - dt);
  }

  // Un ennemi qui se matérialise ne pense pas encore.
  override update(dt: number, ctx: SuitUpdateContext) {
    if (this.isAlive && this.appearanceRemaining > 0) return;
    super.update(dt, ctx);
    if (this.alertRequested) {
      this.alertRequested = false;
      if (this.state === "idle") this.actor.send({ type: "SAW_PLAYER" });
    }
  }
}

export function configureSuitCharacterController(controller: RAPIER.KinematicCharacterController, cfg: SuitConfig) {
  configureEnemyCharacterController(controller, cfg);
}
