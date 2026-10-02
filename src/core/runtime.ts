import { Cause, Effect, Layer, ManagedRuntime } from "effect";
import { DeterministicRandom } from "./random";
import { RaycastService } from "../physics/raycast";
import { PathfindingService } from "../game/level/pathfinding";
import { RenderService } from "../render/renderService";

// see: docs/6-reference/notes-code-core.md#physique-et-services
export const GameLayer = Layer.mergeAll(
  DeterministicRandom.layer,
  RaycastService.layer,
  PathfindingService.layer.pipe(Layer.provide(RaycastService.layer)),
  RenderService.layer,
);

type GameServices = Layer.Success<typeof GameLayer>;

// Un seul runtime par onglet ; le recréer perdrait l’état des services.
export const GameRuntime = ManagedRuntime.make(GameLayer);

// Pas fixe et rendu : zéro suspension ; laisser remonter l’erreur après diagnostic.
export function runGameplaySync<A, E>(
  effect: Effect.Effect<A, E, GameServices>,
): A {
  try {
    return GameRuntime.runSync(effect);
  } catch (error) {
    if (Cause.isAsyncFiberError(error)) {
      console.error(
        "[effect] un Effect gameplay a tenté de suspendre — vérifier qu'aucun " +
          "Effect.tryPromise/Effect.promise/Effect.async/Effect.sleep n'a été " +
          "introduit dans cet arbre (le pas fixe doit rester strictement synchrone).",
        error,
      );
    }
    throw error;
  }
}
