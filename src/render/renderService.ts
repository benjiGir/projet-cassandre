import * as THREE from "three";
import { Context, Effect, Layer } from "effect";

/**
 * Jalon M7 (PLAN_EFFECT_XSTATE.md, §9) : enveloppe Effect du seul appel qui
 * touche vraiment une API externe dans le chemin de rendu — l'appel WebGL
 * lui-même (`WebGLRenderer.render`). Le reste du "rendu" (interpolation de
 * caméra/sprites/viewmodel dans `interpolateVisuals`, fx/audio/HUD dans
 * `updateFx`) reste des `Effect.sync` sans service dédié dans `main.ts` — ce
 * n'est pas un appel à une API externe substituable, juste de
 * l'orchestration, même philosophie que M6 (pas de `PlayerService`/
 * `WeaponService`/`EntityManagerService` sans besoin concret, invariant #9 :
 * pas d'abstraction avant que la douleur soit réelle).
 *
 * `renderer`/`scene`/`camera` sont des PARAMÈTRES de la méthode, jamais
 * stockés dans le service — même raison que `RaycastService`/
 * `PathfindingService` (M3/M4) : ces objets naissent après `GameLayer`/
 * `GameRuntime` (construction du renderer/de la scène dans `main.ts`), donc
 * le service ne peut pas en dépendre à la construction de la Layer.
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
