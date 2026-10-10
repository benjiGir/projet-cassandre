import type * as THREE from "three";

import type { PhysicsWorld } from "../../../physics/world";
import type { LevelDef } from "../../level/catalog/levels";
import type { PersistentEngine } from "../gameEngine";
import { buildGymMode } from "./gymMode";
import type { BuiltLevelMode } from "./levelMode";
import { buildTrainGymMode } from "./trainGymMode";
import { buildTrainRideGymMode } from "./trainRideGymMode";

/** Préparation asynchrone d'un mode, avant la construction de la partie. */
export async function prepareLevelMode(engine: PersistentEngine, choice: LevelDef): Promise<void> {
  // Le voyage en rame fait apparaître des ennemis en plein combat : leurs shaders sont amorcés d'avance.
  if (import.meta.env.DEV && choice.kind === "train-ride-gym") {
    await engine.fx.warmEnemyAppearances(engine.camera, () => engine.renderer.render(engine.scene, engine.camera));
  }
}

/** Le mode d'un niveau construit à la main ; `null` pour un niveau glTF. Les prototypes n'existent qu'en dev. */
export function buildLevelMode(choice: LevelDef, scene: THREE.Object3D, physics: PhysicsWorld): BuiltLevelMode | null {
  if (choice.kind === "gym") return buildGymMode(scene, physics);
  if (import.meta.env.DEV && choice.kind === "train-gym") return buildTrainGymMode(scene, physics);
  if (import.meta.env.DEV && choice.kind === "train-ride-gym") return buildTrainRideGymMode(scene, physics);
  return null;
}
