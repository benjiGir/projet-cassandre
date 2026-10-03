import RAPIER from "@dimforge/rapier3d-compat";

import { moveConfig, type MoveConfig } from "../game/player/movement/moveConfig";

let initialized = false;

// see: docs/6-reference/notes-code-core.md#physique-et-services
export async function initPhysics(): Promise<typeof RAPIER> {
  if (!initialized) {
    await RAPIER.init();
    initialized = true;
  }
  return RAPIER;
}

// Rapier exige des filtres compatibles dans les deux sens.

export const GROUP = {
  WORLD: 1 << 0,
  PLAYER: 1 << 1,
  ENEMY: 1 << 2,
  PLAYER_SHOT: 1 << 3,
  ENEMY_SHOT: 1 << 4,
  DEBRIS: 1 << 5,
  TRIGGER: 1 << 6,
  PROP: 1 << 7,
} as const;

export function interactionGroups(memberships: number, filter: number): number {
  return (((memberships & 0xffff) << 16) | (filter & 0xffff)) >>> 0;
}

const ALL_GROUPS =
  GROUP.WORLD |
  GROUP.PLAYER |
  GROUP.ENEMY |
  GROUP.PLAYER_SHOT |
  GROUP.ENEMY_SHOT |
  GROUP.DEBRIS |
  GROUP.TRIGGER |
  GROUP.PROP;

export const COLLISION_GROUPS = {
  WORLD: interactionGroups(GROUP.WORLD, ALL_GROUPS),
  PLAYER: interactionGroups(
    GROUP.PLAYER,
    GROUP.WORLD | GROUP.ENEMY | GROUP.ENEMY_SHOT | GROUP.TRIGGER | GROUP.PROP,
  ),
  ENEMY: interactionGroups(
    GROUP.ENEMY,
    GROUP.WORLD | GROUP.PLAYER | GROUP.PLAYER_SHOT | GROUP.ENEMY | GROUP.PROP,
  ),
  PLAYER_SHOT: interactionGroups(GROUP.PLAYER_SHOT, GROUP.WORLD | GROUP.ENEMY | GROUP.PROP),
  ENEMY_SHOT: interactionGroups(GROUP.ENEMY_SHOT, GROUP.WORLD | GROUP.PLAYER),
  DEBRIS: interactionGroups(GROUP.DEBRIS, GROUP.WORLD),
  TRIGGER: interactionGroups(GROUP.TRIGGER, GROUP.PLAYER),
  // PROP reste hors WORLD et ignore les tirs ennemis : visibilité et navigation ignorent le mobilier mobile.
  PROP: interactionGroups(
    GROUP.PROP,
    GROUP.WORLD | GROUP.PLAYER | GROUP.ENEMY | GROUP.PLAYER_SHOT | GROUP.PROP,
  ),
} as const;

export function configureCharacterController(
  controller: RAPIER.KinematicCharacterController,
  cfg: MoveConfig = moveConfig,
) {
  controller.setUp({ x: 0, y: 1, z: 0 });
  controller.setOffset(cfg.colliderOffset);
  controller.setSlideEnabled(true);
  controller.enableAutostep(
    cfg.autostepMaxHeight,
    cfg.autostepMinWidth,
    cfg.autostepIncludeDynamicBodies,
  );
  controller.enableSnapToGround(cfg.snapToGroundDistance);
  controller.setMaxSlopeClimbAngle((cfg.maxSlopeClimbAngleDeg * Math.PI) / 180);
  controller.setMinSlopeSlideAngle((cfg.minSlopeSlideAngleDeg * Math.PI) / 180);
  controller.setApplyImpulsesToDynamicBodies(true);
  controller.setCharacterMass(cfg.characterMass);
}

export class PhysicsWorld {
  readonly world: RAPIER.World;

  constructor(gravity: RAPIER.Vector3 = { x: 0, y: -25, z: 0 }) {
    this.world = new RAPIER.World(gravity);
  }

  get gravityY(): number {
    return this.world.gravity.y;
  }

  createCharacterController(cfg: MoveConfig = moveConfig): RAPIER.KinematicCharacterController {
    const controller = this.world.createCharacterController(cfg.colliderOffset);
    configureCharacterController(controller, cfg);
    return controller;
  }

  step(dt: number) {
    this.world.timestep = dt;
    this.world.step();
  }

  // Rapier ne peuple la broad-phase qu’après un step ; le pas nul ne simule rien.
  refreshSceneQueries() {
    const dt = this.world.timestep;
    this.world.timestep = 0;
    try {
      this.world.step();
    } finally {
      this.world.timestep = dt;
    }
  }
}
