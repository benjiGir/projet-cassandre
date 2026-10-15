import * as THREE from "three";

import { playTrainWarning } from "../../../core/audio/audio";
import type { PhysicsWorld } from "../../../physics/world";
import { buildTrainGym, type TrainGym } from "../../level/catalog/trainGym";
import { trainConfig } from "../../level/trains/trainConfig";
import type { GameEngine, PersistentEngine } from "../gameEngine";
import type { GameSession } from "../gameSession";
import { updateTrainGym } from "../player/trainGymGameplay";
import { bakeNavGraph, spawnSuitAt } from "../spawning";
import { disposeModeRoot, type BuiltLevelMode, type LevelMode } from "./levelMode";

/** Zone praticable de la salle d'essai des trains, cuite en graphe de navigation. */
const NAV_BOUNDS = new THREE.Box3(new THREE.Vector3(-9.5, -0.4, -21.5), new THREE.Vector3(13.5, 3, 24.5));
/** Costards témoins, sur le quai opposé : les rames doivent pouvoir les faucher. */
const WITNESS_SUITS = [
  [9, -15],
  [12, -15],
  [9, -20],
  [12, -20],
] as const;

// see: docs/4-technique/prototype-trains.md#contact-mortel
class TrainGymMode implements LevelMode {
  readonly entityCount = 0;

  constructor(
    private readonly scene: THREE.Object3D,
    private readonly root: THREE.Group,
    readonly gym: TrainGym,
  ) {}

  populate(engine: PersistentEngine, session: GameSession): void {
    session.level.navGraph = bakeNavGraph(session.physics, NAV_BOUNDS);
    for (const [x, z] of WITNESS_SUITS) spawnSuitAt(engine, session, x, 1, z);
  }

  fixedStep(engine: GameEngine, dt: number, use: boolean): void {
    updateTrainGym(engine, this.gym, dt, use);
  }

  interpolate(alpha: number, elapsed: number): void {
    this.gym.presentation.interpolate(this.gym.system, alpha, elapsed);
  }

  present(): void {
    if (this.gym.system.takeWarningSounds() > 0 && trainConfig.soundWarning) playTrainWarning();
  }

  resetForReplay(): void {
    this.gym.system.enqueue({ type: "reset" });
  }

  dispose(): void {
    disposeModeRoot(this.scene, this.root, [() => this.gym.presentation.dispose(), () => this.gym.bodies.dispose()]);
  }
}

export function buildTrainGymMode(scene: THREE.Object3D, physics: PhysicsWorld): BuiltLevelMode {
  const root = new THREE.Group();
  scene.add(root);
  const gym = buildTrainGym(root, physics);
  return { mode: new TrainGymMode(scene, root, gym), spawn: gym.spawn, spawnYaw: gym.spawnYaw };
}

/** La salle d'essai des trains de CETTE partie, pour les outils de dev. */
export function trainGymOf(session: Pick<GameSession, "mode">): TrainGym | null {
  return session.mode instanceof TrainGymMode ? session.mode.gym : null;
}
