import RAPIER from "@dimforge/rapier3d-compat";
import { Context, Effect, Layer } from "effect";

import type { PhysicsWorld } from "./world";

/**
 * Jalon M3 (PLAN_EFFECT_XSTATE.md) : enveloppe Effect des TROIS requêtes
 * physiques de raycasting/shape-query réellement utilisées par le jeu.
 *
 * Le jeu n'utilise PAS `THREE.Raycaster` (vérifié par grep sur tout `src/`
 * avant ce jalon, zéro occurrence) — uniquement l'API physique de Rapier :
 * `world.castRay`, `world.castRayAndGetNormal`, `world.intersectionsWithShape`.
 * Ce service les enveloppe 1:1, avec la signature native complète (mêmes
 * paramètres, même information de retour — normale/timeOfImpact/collider,
 * rien de perdu derrière une ADT plus pauvre).
 *
 * `physics: PhysicsWorld` est un PARAMÈTRE de chaque méthode, jamais stocké
 * dans le service : `PhysicsWorld` est construit après `GameLayer`/
 * `GameRuntime` (init WASM Rapier asynchrone dans `main.ts`), le service ne
 * peut donc pas en dépendre à la construction de la Layer — et ça permet à
 * une Layer de test de fournir des résultats scriptés sans jamais construire
 * de vrai monde Rapier (précondition du jalon M5).
 *
 * Discipline zéro-allocation : `ray`/`shapePos`/`shapeRot`/`shape` sont
 * fournis DÉJÀ CONSTRUITS par l'appelant (les `RAPIER.Ray` "scratch" de
 * `weapons.ts`/`suit.ts`/`director.ts`, réutilisés à chaque appel plutôt que
 * recréés) — ce service ne fabrique jamais de `RAPIER.Ray` en interne, il ne
 * fait que le transmettre à Rapier.
 *
 * Forme du service nommée séparément (`RaycastServiceShape`, plutôt qu'inline
 * dans `Context.Service<...>`) pour être réutilisable par `RaycastService.test`
 * ci-dessous ET par un futur jalon M5 (Layer scriptée pour tester le
 * comportement Suit/Director sans monde Rapier réel).
 */
export interface RaycastServiceShape {
  /**
   * Miroir 1:1 de `RAPIER.World.castRay` — booléen hit/pas-hit avec
   * collider/timeOfImpact, mais SANS normale. Utilisé pour la ligne de vue
   * (`hasClearWorldPath`) et l'évitement local (`castAvoidanceRay`) de
   * `suit.ts`/`director.ts`.
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
   * normale. Utilisé pour la résolution d'attaque de `suit.ts`/`director.ts`
   * et les plombs du pompe (`weapons.ts`).
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

  /**
   * Miroir de `RAPIER.World.intersectionsWithShape` — requête de forme
   * callback-based côté Rapier, mais le callback lui-même n'est PAS exposé
   * ici : les colliders touchés sont collectés dans un tableau retourné,
   * pour rester un `Effect.sync` direct sans fuite d'un point d'entrée
   * impératif vers l'appelant. Utilisé pour la capsule du pied-de-biche
   * (`weapons.ts`).
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
   * Layer de test scriptée — résultats fixes indépendants d'un vrai monde
   * Rapier, réutilisable par un futur jalon (M5, comportement Suit/Director)
   * pour tester ligne de vue/évitement/résolution d'attaque de façon
   * déterministe sans jamais construire de monde physique réel. Chaque
   * méthode par défaut renvoie "rien touché" (`null`/tableau vide) ; passer
   * un override par méthode pour scripter un résultat précis (voir
   * `test/physics/raycast.test.ts` pour un exemple d'usage).
   */
  static readonly test = (overrides: Partial<RaycastServiceShape> = {}) =>
    Layer.succeed(
      RaycastService,
      RaycastService.of({
        castRay: () => Effect.succeed(null),
        castRayAndGetNormal: () => Effect.succeed(null),
        intersectionsWithShape: () => Effect.succeed([]),
        ...overrides,
      }),
    );
}
