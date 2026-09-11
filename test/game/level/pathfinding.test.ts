/**
 * Jalon M4 (PLAN_EFFECT_XSTATE.md) : `PathfindingService` — premier vrai
 * système de pathfinding du jeu (graphe de praticabilité 2.5D baké au
 * chargement, A* déterministe). Fixtures Rapier synthétiques construites à
 * la main (pas de vrai `.glb`), même style que `test/physics/raycast.test.ts`
 * (M3) : `bake`/`findPath` passent tous deux par `RaycastService`/
 * `PathfindingService` réels contre un petit monde Rapier en mémoire.
 *
 * Piège Rapier déjà découvert en M3, réutilisé ici tel quel (voir la doc de
 * tête de `raycast.test.ts`) : un monde Rapier tout juste construit ne
 * renvoie AUCUN hit de raycast tant qu'un `physics.step(0)` n'a pas été
 * appelé au moins une fois après la création des colliders (broad-phase pas
 * encore peuplée) — chaque fixture ci-dessous appelle `physics.step(0)`
 * avant tout `bake`.
 */
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { initPhysics, PhysicsWorld, COLLISION_GROUPS } from "../../../src/physics/world";
import { GameLayer } from "../../../src/core/runtime";
import { navGraphStats, PathNotFoundError, PathfindingService, type NavGraph } from "../../../src/game/level/pathfinding";

await initPhysics();

function box(
  physics: PhysicsWorld,
  center: { x: number; y: number; z: number },
  halfExtents: { x: number; y: number; z: number },
  rotation: { x: number; y: number; z: number; w: number } = { x: 0, y: 0, z: 0, w: 1 },
): RAPIER.Collider {
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z).setRotation(rotation),
  );
  return physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setCollisionGroups(COLLISION_GROUPS.WORLD),
    body,
  );
}

describe("PathfindingService (jalon M4) — bake + findPath, contre un vrai monde Rapier", () => {
  it.effect("sol plat ouvert : trouve un chemin direct entre deux points éloignés", () =>
    Effect.gen(function* () {
      const physics = new PhysicsWorld();
      // Sol 20×20 m, surface à y=0.
      box(physics, { x: 0, y: -0.1, z: 0 }, { x: 10, y: 0.1, z: 10 });
      physics.step(0);

      const pf = yield* PathfindingService;
      const bounds = new THREE.Box3(new THREE.Vector3(-10, -1, -10), new THREE.Vector3(10, 3, 10));
      const graph = yield* pf.bake(physics, bounds);

      const stats = navGraphStats(graph);
      assert.isAbove(stats.walkableCount, 100); // sol ouvert : la quasi-totalité de la grille doit être praticable.
      assert.isAbove(stats.edgeCount, 0);

      const from = new THREE.Vector3(-8, 0, 0);
      const to = new THREE.Vector3(8, 0, 0);
      const path = yield* pf.findPath(graph, from, to);

      assert.isAbove(path.length, 0);
      const last = path[path.length - 1]!;
      assert.approximately(last.x, to.x, graph.cellSize);
      assert.approximately(last.z, to.z, graph.cellSize);

      // Chemin en ligne droite sur sol ouvert : la longueur totale ne doit
      // pas s'écarter significativement de la distance euclidienne directe
      // (tolérance généreuse pour la discrétisation de grille).
      let travelled = 0;
      let prev = from;
      for (const waypoint of path) {
        travelled += Math.hypot(waypoint.x - prev.x, waypoint.z - prev.z);
        prev = waypoint;
      }
      assert.isBelow(travelled, from.distanceTo(to) * 1.2);
    }).pipe(Effect.provide(GameLayer)),
  );

  it.effect("mur avec ouverture : le chemin contourne l'obstacle plutôt que le traverser", () =>
    Effect.gen(function* () {
      const physics = new PhysicsWorld();
      // Sol 20×20 m, surface à y=0.
      box(physics, { x: 0, y: -0.1, z: 0 }, { x: 10, y: 0.1, z: 10 });
      // Mur plein du bord z=-10 jusqu'à z=2.2 (ouverture au-delà, vers z=10) —
      // bloque tout chemin direct en ligne droite le long de z=0.
      const wallHalfZ = (2.2 - -10) / 2;
      const wallCenterZ = (-10 + 2.2) / 2;
      box(physics, { x: 0, y: 1.5, z: wallCenterZ }, { x: 0.5, y: 1.5, z: wallHalfZ });
      physics.step(0);

      const pf = yield* PathfindingService;
      const bounds = new THREE.Box3(new THREE.Vector3(-10, -1, -10), new THREE.Vector3(10, 4, 10));
      const graph = yield* pf.bake(physics, bounds);

      const from = new THREE.Vector3(-8, 0, 0);
      const to = new THREE.Vector3(8, 0, 0);
      const path = yield* pf.findPath(graph, from, to);

      assert.isAbove(path.length, 0);

      // Un chemin qui traverserait le mur en ligne droite resterait à z≈0
      // partout ; un vrai détour doit passer par l'ouverture (z > 2.2 à un
      // moment), et sa longueur doit dépasser nettement la distance directe.
      const maxZ = path.reduce((m, w) => Math.max(m, w.z), Number.NEGATIVE_INFINITY);
      assert.isAbove(maxZ, 2.2);

      let travelled = 0;
      let prev = from;
      for (const waypoint of path) {
        travelled += Math.hypot(waypoint.x - prev.x, waypoint.z - prev.z);
        prev = waypoint;
      }
      assert.isAbove(travelled, from.distanceTo(to) * 1.05); // détour réel, pas une ligne droite déguisée.
    }).pipe(Effect.provide(GameLayer)),
  );

  it.effect(
    "escalier Zone D reproduit en fixture : un chemin relie le rez-de-chaussée à la mezzanine (2 m plus haut)",
    () =>
      Effect.gen(function* () {
        const physics = new PhysicsWorld();

        // Plateforme basse, surface à y=0, x ∈ [-4, 0].
        box(physics, { x: -2, y: -0.15, z: 0 }, { x: 2, y: 0.15, z: 2 });
        // Plateforme haute ("mezzanine"), surface à y=2, x ∈ [2, 6].
        box(physics, { x: 4, y: 1.85, z: 0 }, { x: 2, y: 0.15, z: 2 });

        // Rampe unique (UN SEUL collider, comme un vrai proxy de kit —
        // `col_hull_*`/`collision-proxy-authoring` — pas une volée de
        // marches individuelles : voir le rapport de tâche pour la
        // justification, un proxy par marche ferait buter le test
        // d'élagage à capsule sur les contremarches voisines) : incline à
        // 45° EXACT (pente documentée du kit, CLAUDE.md), reliant (0,0) à
        // (2,2) dans le plan XY, épaisseur 0.4 m, largeur 4 m (z ∈ [-2,2]).
        const runX = 2;
        const riseY = 2;
        const halfThickness = 0.2;
        const length = Math.hypot(runX, riseY);
        const angle = Math.atan2(riseY, runX);
        const dir = new THREE.Vector3(runX, riseY, 0).normalize();
        const upNormal = new THREE.Vector3(-dir.y, dir.x, 0); // perpendiculaire "vers le haut" de l'incline.
        const center = new THREE.Vector3(runX / 2, riseY / 2, 0).addScaledVector(upNormal, -halfThickness);
        const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
        box(
          physics,
          { x: center.x, y: center.y, z: center.z },
          { x: length / 2, y: halfThickness, z: 2 },
          { x: quat.x, y: quat.y, z: quat.z, w: quat.w },
        );

        physics.step(0);

        const pf = yield* PathfindingService;
        const bounds = new THREE.Box3(new THREE.Vector3(-5, -1, -3), new THREE.Vector3(7, 3, 3));
        const graph = yield* pf.bake(physics, bounds);

        const from = new THREE.Vector3(-3, 0, 0); // rez-de-chaussée.
        const to = new THREE.Vector3(5, 2, 0); // mezzanine.
        const path = yield* pf.findPath(graph, from, to);

        assert.isAbove(path.length, 0, "un chemin doit être trouvé entre le rez-de-chaussée et la mezzanine");

        const last = path[path.length - 1]!;
        assert.approximately(last.x, to.x, graph.cellSize * 2);
        assert.approximately(last.y, to.y, 0.3);

        // Preuve que le chemin grimpe réellement via la rampe (pas un trou
        // de géométrie qui connecterait directement les deux hauteurs) :
        // au moins un waypoint intermédiaire à une hauteur clairement entre
        // les deux plateformes.
        const maxIntermediateY = path.slice(0, -1).reduce((m, w) => Math.max(m, w.y), Number.NEGATIVE_INFINITY);
        assert.isAbove(maxIntermediateY, 0.5);
      }).pipe(Effect.provide(GameLayer)),
  );

  it.effect("deux plateformes non reliées : findPath échoue avec PathNotFoundError", () =>
    Effect.gen(function* () {
      const physics = new PhysicsWorld();
      // Deux îlots plats, séparés par un vide de 6 m (bien au-delà de
      // `avoidanceRayLength`/de la portée de tout saut), aucune géométrie
      // entre les deux.
      box(physics, { x: -5, y: -0.15, z: 0 }, { x: 2, y: 0.15, z: 2 });
      box(physics, { x: 5, y: -0.15, z: 0 }, { x: 2, y: 0.15, z: 2 });
      physics.step(0);

      const pf = yield* PathfindingService;
      const bounds = new THREE.Box3(new THREE.Vector3(-8, -1, -3), new THREE.Vector3(8, 2, 3));
      const graph = yield* pf.bake(physics, bounds);

      const from = new THREE.Vector3(-5, 0, 0);
      const to = new THREE.Vector3(5, 0, 0);
      const error = yield* Effect.flip(pf.findPath(graph, from, to));

      assert.instanceOf(error, PathNotFoundError);
    }).pipe(Effect.provide(GameLayer)),
  );
});

describe("PathfindingService.test (jalon M4) — Layer scriptée, sans monde Rapier", () => {
  it.effect("par défaut, bake renvoie un graphe vide et findPath échoue systématiquement", () =>
    Effect.gen(function* () {
      const pf = yield* PathfindingService;
      const dummyPhysics = null as unknown as PhysicsWorld; // jamais déréférencé par la Layer de test.

      const graph = yield* pf.bake(dummyPhysics, new THREE.Box3());
      assert.strictEqual(navGraphStats(graph).cellCount, 0);

      const error = yield* Effect.flip(pf.findPath(graph, new THREE.Vector3(), new THREE.Vector3(1, 0, 1)));
      assert.instanceOf(error, PathNotFoundError);
    }).pipe(Effect.provide(PathfindingService.test())),
  );

  it.effect("un override scripte un chemin précis, sans jamais toucher Rapier", () => {
    const scriptedPath = [new THREE.Vector3(1, 0, 1), new THREE.Vector3(2, 0, 2)];

    return Effect.gen(function* () {
      const pf = yield* PathfindingService;
      const path = yield* pf.findPath(
        null as unknown as NavGraph,
        new THREE.Vector3(),
        new THREE.Vector3(),
      );
      assert.strictEqual(path, scriptedPath);
    }).pipe(
      Effect.provide(PathfindingService.test({ findPath: () => Effect.succeed(scriptedPath) })),
    );
  });
});

// Régression : jusqu'au 2026-09-11, le chargement de niveau bakait le graphe sans jamais faire
// avancer Rapier, et le graphe sortait vide dans tous les niveaux du jeu.
describe("PhysicsWorld.refreshSceneQueries — colliders neufs visibles au bake", () => {
  it.effect("sans rafraîchissement le graphe est vide, avec il couvre le sol", () =>
    Effect.gen(function* () {
      const pf = yield* PathfindingService;
      const bounds = new THREE.Box3(new THREE.Vector3(-5, -1, -5), new THREE.Vector3(5, 3, 5));

      const stale = new PhysicsWorld();
      box(stale, { x: 0, y: -0.1, z: 0 }, { x: 5, y: 0.1, z: 5 });
      assert.strictEqual(navGraphStats(yield* pf.bake(stale, bounds)).walkableCount, 0);

      const fresh = new PhysicsWorld();
      box(fresh, { x: 0, y: -0.1, z: 0 }, { x: 5, y: 0.1, z: 5 });
      const timestepBefore = fresh.world.timestep;
      fresh.refreshSceneQueries();
      assert.strictEqual(fresh.world.timestep, timestepBefore);
      assert.isAbove(navGraphStats(yield* pf.bake(fresh, bounds)).walkableCount, 100);
    }).pipe(Effect.provide(GameLayer)),
  );
});
