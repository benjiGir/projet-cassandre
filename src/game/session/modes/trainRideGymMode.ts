import * as THREE from "three";

import type { PhysicsWorld } from "../../../physics/world";
import { buildTrainRideGym, type TrainRideGym } from "../../level/catalog/trainRideGym";
import type { GameEngine, PersistentEngine } from "../gameEngine";
import type { GameSession } from "../gameSession";
import { updateTrainRideGym } from "../player/trainRideGameplay";
import { bakeNavGraph } from "../spawning";
import { disposeModeRoot, type BuiltLevelMode, type LevelMode } from "./levelMode";

/** Le plancher de la rame : seule zone où les ennemis embarqués se déplacent. */
const NAV_BOUNDS = new THREE.Box3(new THREE.Vector3(-1.5, -0.4, -22), new THREE.Vector3(1.5, 0.4, 22));

// see: docs/4-technique/prototype-voyage-rame.md#horloge-et-mouvement
class TrainRideGymMode implements LevelMode {
  readonly entityCount = 0;

  constructor(
    private readonly scene: THREE.Object3D,
    private readonly root: THREE.Group,
    readonly gym: TrainRideGym,
  ) {}

  populate(_engine: PersistentEngine, session: GameSession): void {
    session.level.doorSystem = this.gym.doors;
    session.level.navGraph = bakeNavGraph(session.physics, NAV_BOUNDS);
  }

  fixedStep(engine: GameEngine, dt: number, use: boolean): void {
    updateTrainRideGym(engine, this.gym, dt, use);
  }

  interpolate(alpha: number, elapsed: number): void {
    this.gym.presentation.interpolate(this.gym.system, alpha, elapsed);
  }

  resetForReplay(): void {
    this.gym.system.enqueue("reset");
  }

  dispose(): void {
    disposeModeRoot(this.scene, this.root, [() => this.gym.presentation.dispose(this.root)]);
  }
}

export function buildTrainRideGymMode(scene: THREE.Object3D, physics: PhysicsWorld): BuiltLevelMode {
  const root = new THREE.Group();
  scene.add(root);
  const gym = buildTrainRideGym(root, physics);
  return { mode: new TrainRideGymMode(scene, root, gym), spawn: gym.spawn, spawnYaw: 0 };
}

/** Le prototype de voyage en rame de CETTE partie, pour les outils de dev. */
export function trainRideGymOf(session: Pick<GameSession, "mode">): TrainRideGym | null {
  return session.mode instanceof TrainRideGymMode ? session.mode.gym : null;
}
