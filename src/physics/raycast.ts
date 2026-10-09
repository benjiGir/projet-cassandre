import type RAPIER from "@dimforge/rapier3d-compat";
import { Context, Effect, Layer } from "effect";

import type { PhysicsWorld } from "./world";

// see: docs/6-reference/notes-code-core.md#physique-et-services
export interface RaycastServiceShape {
  readonly castRay: (
    physics: PhysicsWorld,
    ray: RAPIER.Ray,
    maxToi: number,
    solid: boolean,
    filterFlags?: RAPIER.QueryFilterFlags,
    filterGroups?: RAPIER.InteractionGroups,
    filterExcludeCollider?: RAPIER.Collider,
    filterExcludeRigidBody?: RAPIER.RigidBody,
    filterPredicate?: (collider: RAPIER.Collider) => boolean,
  ) => Effect.Effect<RAPIER.RayColliderHit | null>;

  readonly castRayAndGetNormal: (
    physics: PhysicsWorld,
    ray: RAPIER.Ray,
    maxToi: number,
    solid: boolean,
    filterFlags?: RAPIER.QueryFilterFlags,
    filterGroups?: RAPIER.InteractionGroups,
    filterExcludeCollider?: RAPIER.Collider,
    filterExcludeRigidBody?: RAPIER.RigidBody,
    filterPredicate?: (collider: RAPIER.Collider) => boolean,
  ) => Effect.Effect<RAPIER.RayColliderIntersection | null>;

  readonly castShape: (
    physics: PhysicsWorld,
    shapePos: RAPIER.Vector,
    shapeRot: RAPIER.Rotation,
    shapeVel: RAPIER.Vector,
    shape: RAPIER.Shape,
    targetDistance: number,
    maxToi: number,
    stopAtPenetration: boolean,
    filterFlags?: RAPIER.QueryFilterFlags,
    filterGroups?: RAPIER.InteractionGroups,
  ) => Effect.Effect<RAPIER.ColliderShapeCastHit | null>;

  readonly intersectionsWithShape: (
    physics: PhysicsWorld,
    shapePos: RAPIER.Vector,
    shapeRot: RAPIER.Rotation,
    shape: RAPIER.Shape,
    filterFlags?: RAPIER.QueryFilterFlags,
    filterGroups?: RAPIER.InteractionGroups,
    filterExcludeCollider?: RAPIER.Collider,
    filterExcludeRigidBody?: RAPIER.RigidBody,
    filterPredicate?: (collider: RAPIER.Collider) => boolean,
  ) => Effect.Effect<RAPIER.Collider[]>;
}

export class RaycastService extends Context.Service<RaycastService, RaycastServiceShape>()(
  "cassandre/physics/RaycastService",
) {
  static readonly layer = Layer.succeed(
    RaycastService,
    RaycastService.of({
      castRay: (
        physics,
        ray,
        maxToi,
        solid,
        filterFlags,
        filterGroups,
        filterExcludeCollider,
        filterExcludeRigidBody,
        filterPredicate,
      ) =>
        Effect.sync(() =>
          physics.world.castRay(
            ray,
            maxToi,
            solid,
            filterFlags,
            filterGroups,
            filterExcludeCollider,
            filterExcludeRigidBody,
            filterPredicate,
          ),
        ),

      castRayAndGetNormal: (
        physics,
        ray,
        maxToi,
        solid,
        filterFlags,
        filterGroups,
        filterExcludeCollider,
        filterExcludeRigidBody,
        filterPredicate,
      ) =>
        Effect.sync(() =>
          physics.world.castRayAndGetNormal(
            ray,
            maxToi,
            solid,
            filterFlags,
            filterGroups,
            filterExcludeCollider,
            filterExcludeRigidBody,
            filterPredicate,
          ),
        ),

      castShape: (
        physics,
        shapePos,
        shapeRot,
        shapeVel,
        shape,
        targetDistance,
        maxToi,
        stopAtPenetration,
        filterFlags,
        filterGroups,
      ) =>
        Effect.sync(() =>
          physics.world.castShape(
            shapePos,
            shapeRot,
            shapeVel,
            shape,
            targetDistance,
            maxToi,
            stopAtPenetration,
            filterFlags,
            filterGroups,
          ),
        ),

      intersectionsWithShape: (
        physics,
        shapePos,
        shapeRot,
        shape,
        filterFlags,
        filterGroups,
        filterExcludeCollider,
        filterExcludeRigidBody,
        filterPredicate,
      ) =>
        Effect.sync(() => {
          const hits: RAPIER.Collider[] = [];
          physics.world.intersectionsWithShape(
            shapePos,
            shapeRot,
            shape,
            (collider) => {
              hits.push(collider);
              return true; // true poursuit la collecte au lieu de l’arrêter au premier collider.
            },
            filterFlags,
            filterGroups,
            filterExcludeCollider,
            filterExcludeRigidBody,
            filterPredicate,
          );
          return hits;
        }),
    }),
  );

  static readonly test = (overrides: Partial<RaycastServiceShape> = {}) =>
    Layer.succeed(
      RaycastService,
      RaycastService.of({
        castRay: () => Effect.succeed(null),
        castRayAndGetNormal: () => Effect.succeed(null),
        castShape: () => Effect.succeed(null),
        intersectionsWithShape: () => Effect.succeed([]),
        ...overrides,
      }),
    );
}
