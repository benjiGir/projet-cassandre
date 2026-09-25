import RAPIER from "@dimforge/rapier3d-compat";
import { Context, Effect, Layer } from "effect";

import type { PhysicsWorld } from "./world";

/**
 * Enveloppe Effect des requêtes physiques Rapier utilisées par le jeu
 * (`castRay`, `castRayAndGetNormal`, `castShape`, `intersectionsWithShape`) — le jeu
 * n'utilise pas `THREE.Raycaster`.
 *
 * `physics: PhysicsWorld` est un PARAMÈTRE de chaque méthode, jamais stocké
 * dans le service : `PhysicsWorld` est construit après `GameLayer`/
 * `GameRuntime` (init WASM asynchrone), et ça permet à `RaycastService.test`
 * de scripter des résultats sans monde Rapier réel.
 *
 * Discipline zéro-allocation : les `RAPIER.Ray`/formes sont fournis déjà
 * construits par l'appelant (scratch réutilisé) — ce service n'en fabrique
 * jamais lui-même.
 *
 * see: docs/systems/physique.md#service-de-raycasting-raycastservice
 */
export interface RaycastServiceShape {
  /**
   * Miroir 1:1 de `RAPIER.World.castRay` — hit/pas-hit avec collider et
   * timeOfImpact, sans normale.
   *
   * see: docs/systems/physique.md#service-de-raycasting-raycastservice
   */
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

  /**
   * Miroir 1:1 de `RAPIER.World.castRayAndGetNormal` — hit détaillé avec
   * normale.
   *
   * see: docs/systems/physique.md#service-de-raycasting-raycastservice
   */
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

  /** Balayage de la capsule réelle entre deux cellules de navigation. */
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

  /**
   * Miroir de `RAPIER.World.intersectionsWithShape` : les colliders touchés
   * sont collectés dans un tableau retourné plutôt qu'exposés via un
   * callback, pour rester un `Effect.sync` direct.
   *
   * see: docs/systems/physique.md#service-de-raycasting-raycastservice
   */
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

      castShape: (physics, shapePos, shapeRot, shapeVel, shape, targetDistance, maxToi, stopAtPenetration, filterFlags, filterGroups) =>
        Effect.sync(() => physics.world.castShape(
          shapePos, shapeRot, shapeVel, shape, targetDistance, maxToi, stopAtPenetration,
          filterFlags, filterGroups,
        )),

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
              return true; // continue : on veut TOUS les colliders touchés, pas seulement le premier.
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

  /**
   * Layer de test scriptée — résultats indépendants d'un vrai monde Rapier.
   * Chaque méthode renvoie par défaut "rien touché" (`null`/tableau vide) ;
   * passer un override par méthode pour scripter un résultat précis (voir
   * `test/physics/raycast.test.ts`).
   *
   * see: docs/systems/physique.md#service-de-raycasting-raycastservice
   */
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
