import { Context, Effect, Layer } from "effect";
import { RaycastService } from "../../physics/raycast";
import { PathNotFoundError, type PathfindingServiceShape } from "./pathfindingTypes";
import { EMPTY_NAV_GRAPH } from "./navGraph";
import { bakeNavGraphEffect } from "./navBake";
import { findPathEffect } from "./navSearch";

export class PathfindingService extends Context.Service<PathfindingService, PathfindingServiceShape>()(
  "cassandre/game/level/PathfindingService",
) {
  static readonly layer = Layer.effect(
    PathfindingService,
    Effect.gen(function* () {
      const raycasts = yield* RaycastService;
      return PathfindingService.of({
        bake: (physics, bounds) => bakeNavGraphEffect(physics, bounds).pipe(Effect.provideService(RaycastService, raycasts)),
        findPath: findPathEffect,
      });
    }),
  );

  static readonly test = (overrides: Partial<PathfindingServiceShape> = {}) =>
    Layer.succeed(
      PathfindingService,
      PathfindingService.of({
        bake: () => Effect.succeed(EMPTY_NAV_GRAPH),
        findPath: (_graph, from, to) =>
          Effect.fail(new PathNotFoundError({ fromX: from.x, fromZ: from.z, toX: to.x, toZ: to.z })),
        ...overrides,
      }),
    );
}
