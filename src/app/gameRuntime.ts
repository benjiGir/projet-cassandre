import { Layer, ManagedRuntime } from "effect";
import { DeterministicRandom } from "../core/random";
import { createGameplayRunner } from "../core/runtime";
import { RaycastService } from "../physics/raycast";
import { PathfindingService } from "../game/level/pathfinding";
import { RenderService } from "../render/renderService";

export const GameLayer = Layer.mergeAll(
  DeterministicRandom.layer,
  RaycastService.layer,
  PathfindingService.layer.pipe(Layer.provide(RaycastService.layer)),
  RenderService.layer,
);

// Un seul runtime par onglet ; le recréer perdrait l’état des services.
export const GameRuntime = ManagedRuntime.make(GameLayer);
export const runGameplaySync = createGameplayRunner(GameRuntime);
