import { Cause, Effect, Layer, ManagedRuntime } from "effect";
import { DeterministicRandom } from "./random";
import { RaycastService } from "../physics/raycast";
import { PathfindingService } from "../game/level/pathfinding";
import { RenderService } from "../render/renderService";

/**
 * Racine de composition Effect du jeu. Chaque service ajouté par les
 * jalons suivants (RaycastService en M3, PathfindingService en M4,
 * RenderService en M7, ...) rejoint cette Layer via
 * Layer.provideMerge/Layer.merge — jamais une Layer ad hoc construite
 * ailleurs.
 */
export const GameLayer = Layer.mergeAll(
  DeterministicRandom.layer,
  RaycastService.layer,
  PathfindingService.layer,
  RenderService.layer,
);

type GameServices = Layer.Success<typeof GameLayer>;

/**
 * Runtime unique du jeu, construit une fois. Ne JAMAIS en recréer un
 * second pendant une partie (perdrait l'état de tout service à état,
 * romprait le déterminisme).
 */
export const GameRuntime = ManagedRuntime.make(GameLayer);

/**
 * Frontière synchrone stricte du pas fixe (invariant #11, CLAUDE.md) : tout
 * Effect exécuté ici DOIT être purement synchrone — zéro
 * Effect.tryPromise/Effect.promise/Effect.async/Effect.sleep dans l'arbre.
 * Si un tel Effect suspend, `Effect.runSync` lève un
 * `Cause.AsyncFiberError` ; on le laisse remonter (ne JAMAIS l'avaler),
 * avec un message explicite en console pour qu'un bug de ce genre soit
 * bruyant plutôt que silencieux.
 *
 * see: docs/systems/boucle-de-jeu.md#frontière-effect-synchrone-du-pas-fixe
 */
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
