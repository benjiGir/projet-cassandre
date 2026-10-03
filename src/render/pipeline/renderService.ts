import * as THREE from "three";
import { Context, Effect, Layer } from "effect";

// see: docs/6-reference/notes-code-rendu.md#frontiere-effect-et-temps
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

  static readonly test = (overrides: Partial<RenderServiceShape> = {}) =>
    Layer.succeed(
      RenderService,
      RenderService.of({
        render: () => Effect.void,
        ...overrides,
      }),
    );
}
