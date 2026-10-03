import { Layer, ManagedRuntime } from "effect";
import { DeterministicRandom } from "../../core/effect/random";
import { createGameplayRunner } from "../../core/effect/runtime";
import { RaycastService } from "../../physics/raycast";
import { PathfindingService } from "../../game/level/navigation/pathfinding";
import { RenderService } from "../../render/pipeline/renderService";

export const GameLayer = Layer.mergeAll(
  DeterministicRandom.layer,
  RaycastService.layer,
  PathfindingService.layer.pipe(Layer.provide(RaycastService.layer)),
  RenderService.layer,
);

// Un seul runtime par onglet ; le recréer perdrait l’état des services.
export const GameRuntime = ManagedRuntime.make(GameLayer);
export const runGameplaySync = createGameplayRunner(GameRuntime);
