import * as THREE from "three";
import { Context, Effect, Layer } from "effect";

/**
 * Jalon M7 : enveloppe Effect du seul appel qui touche vraiment une API
 * externe dans le chemin de rendu — l'appel WebGL lui-même
 * (`WebGLRenderer.render`). Le reste du "rendu" (`interpolateVisuals`,
 * `updateFx`, dans `game/loop/`) reste des `Effect.sync` sans service dédié :
 * pas un appel à une API externe substituable, juste de l'orchestration.
 *
 * `renderer`/`scene`/`camera` sont des PARAMÈTRES de la méthode, jamais
 * stockés dans le service — ces objets naissent après `GameLayer`/
 * `GameRuntime` (construction dans `game/session/gameEngine.ts`), donc le
 * service ne peut pas en dépendre à la construction de la Layer.
 * see: docs/systems/boucle-de-jeu.md#frontière-effect-synchrone-du-pas-fixe
 */
export interface RenderServiceShape {
  readonly render: (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) => Effect.Effect<void>;
}

export class RenderService extends Context.Service<RenderService, RenderServiceShape>()(
  "cassandre/render/RenderService",
) {
  static readonly layer = Layer.succeed(
    RenderService,
    RenderService.of({
      render: (renderer, scene, camera) => Effect.sync(() => renderer.render(scene, camera)),
    }),
  );

  /** Layer de test scriptée — no-op par défaut, même précédent que `RaycastService.test`/`PathfindingService.test` (M3/M4). */
  static readonly test = (overrides: Partial<RenderServiceShape> = {}) =>
    Layer.succeed(
      RenderService,
      RenderService.of({
        render: () => Effect.void,
        ...overrides,
      }),
    );
}
