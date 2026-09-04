/**
 * Jalon M7 (PLAN_EFFECT_XSTATE.md, §9) : test de CONTRAT — `RenderService`
 * ne fait rien d'autre qu'appeler `renderer.render(scene, camera)` tel quel.
 * Peu de valeur à tester le rendu lui-même (pas de WebGL en Node, voir le
 * plan) ; ce test vérifie juste que le service transmet fidèlement, sans
 * rien transformer ni appeler d'autre méthode.
 */
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { RenderService } from "../../src/render/renderService";

describe("RenderService (jalon M7)", () => {
  it.effect("appelle renderer.render(scene, camera) avec exactement ces arguments, une seule fois", () =>
    Effect.gen(function* () {
      const calls: Array<{ scene: unknown; camera: unknown }> = [];
      const fakeRenderer = {
        render: (scene: unknown, camera: unknown) => {
          calls.push({ scene, camera });
        },
      } as unknown as import("three").WebGLRenderer;
      const fakeScene = { marker: "scene" } as unknown as import("three").Scene;
      const fakeCamera = { marker: "camera" } as unknown as import("three").Camera;

      const rs = yield* RenderService;
      yield* rs.render(fakeRenderer, fakeScene, fakeCamera);

      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0]?.scene, fakeScene);
      assert.strictEqual(calls[0]?.camera, fakeCamera);
    }).pipe(Effect.provide(RenderService.layer)),
  );

  it.effect("RenderService.test() ne touche jamais un vrai renderer", () =>
    Effect.gen(function* () {
      const rs = yield* RenderService;
      // Layer scriptée : no-op, aucun argument réellement utilisé — passer
      // des valeurs bidon prouve qu'aucune méthode n'est appelée dessus.
      yield* rs.render(
        null as unknown as import("three").WebGLRenderer,
        null as unknown as import("three").Scene,
        null as unknown as import("three").Camera,
      );
    }).pipe(Effect.provide(RenderService.test())),
  );
});
