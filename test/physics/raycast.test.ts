/**
 * Jalon M3 (PLAN_EFFECT_XSTATE.md) : `RaycastService` enveloppe les TROIS
 * requêtes physiques réellement utilisées par le jeu — PAS `THREE.Raycaster`
 * (zéro occurrence dans `src/`, voir la correction de conception en tête de
 * la section M3 du plan) : `world.castRay`, `world.castRayAndGetNormal`,
 * `world.intersectionsWithShape`.
 *
 * Deux volets, comme demandé par le plan :
 * - le service RÉEL contre un vrai (petit) monde Rapier construit en
 *   mémoire (Rapier compat fonctionne en Node, cf. M2/`loader.test.ts`) ;
 * - `RaycastService.test` : une Layer scriptée sans monde Rapier du tout,
 *   réutilisable telle quelle par un futur jalon M5 (comportement
 *   Suit/Director testé sans jamais construire de monde physique réel).
 */
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import RAPIER from "@dimforge/rapier3d-compat";

import { initPhysics, PhysicsWorld, COLLISION_GROUPS } from "../../src/physics/world";
import { RaycastService } from "../../src/physics/raycast";

await initPhysics();

/**
 * Un mur cuboïde 2×2×2 (demi-étendue 1) centré à (0, 0, 10), membership WORLD.
 *
 * Piège Rapier découvert en écrivant ce test (vérifié isolément avant
 * d'écrire l'assertion) : les requêtes de type `castRay`/
 * `intersectionsWithShape` interrogent une structure de broad-phase qui
 * n'est peuplée qu'après au moins un `world.step()` — un monde tout juste
 * construit avec un collider fraîchement créé ne renvoie AUCUN hit tant
 * qu'aucun pas n'a été simulé, même si la géométrie est correcte. Un pas à
 * `dt=0` suffit (aucun mouvement, juste la mise à jour de la broad-phase).
 */
function buildWallWorld() {
  const physics = new PhysicsWorld();
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 10),
  );
  const collider = physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(1, 1, 1).setCollisionGroups(COLLISION_GROUPS.WORLD),
    body,
  );
  physics.step(0);
  return { physics, collider };
}

describe("RaycastService (jalon M3) — contre un vrai monde Rapier", () => {
  it.effect("castShape détecte un mur avec la capsule entière", () =>
    Effect.gen(function* () {
      const { physics, collider } = buildWallWorld();
      const raycast = yield* RaycastService;
      const hit = yield* raycast.castShape(
        physics,
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 0, y: 0, z: 10 },
        new RAPIER.Capsule(0.5, 0.3),
        0, 1, false,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        COLLISION_GROUPS.WORLD,
      );
      assert.isNotNull(hit);
      assert.strictEqual(hit!.collider.handle, collider.handle);
    }).pipe(Effect.provide(RaycastService.layer)),
  );

  it.effect("castRay touche un mur connu : bon collider, bon timeOfImpact", () =>
    Effect.gen(function* () {
      const { physics, collider } = buildWallWorld();
      const raycast = yield* RaycastService;
      const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

      const hit = yield* raycast.castRay(
        physics,
        ray,
        20,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        COLLISION_GROUPS.WORLD,
      );

      assert.isNotNull(hit);
      assert.strictEqual(hit!.collider.handle, collider.handle);
      // Face avant du cuboïde : centre z=10, demi-étendue 1 → touché à z=9.
      assert.approximately(hit!.timeOfImpact, 9, 1e-6);
    }).pipe(Effect.provide(RaycastService.layer)),
  );

  it.effect("castRay ne touche rien si le mur est hors de portée (maxToi trop court)", () =>
    Effect.gen(function* () {
      const { physics } = buildWallWorld();
      const raycast = yield* RaycastService;
      const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

      const hit = yield* raycast.castRay(
        physics,
        ray,
        5, // le mur est à z=9, hors de portée avec maxToi=5
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        COLLISION_GROUPS.WORLD,
      );

      assert.isNull(hit);
    }).pipe(Effect.provide(RaycastService.layer)),
  );

  it.effect("castRay respecte le filtre de groupes (aucune interaction hors WORLD)", () =>
    Effect.gen(function* () {
      const { physics } = buildWallWorld();
      const raycast = yield* RaycastService;
      const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

      // Groupe ENEMY_SHOT n'interagit qu'avec WORLD + PLAYER — le mur ci-dessus
      // porte le membership WORLD, donc il devrait quand même être touché ;
      // on vérifie ici le cas négatif avec un filtre qui exclut WORLD (le
      // membership PLAYER seul, qui n'a jamais WORLD dans ses propres bits
      // de membership).
      const hit = yield* raycast.castRay(
        physics,
        ray,
        20,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        COLLISION_GROUPS.PLAYER_SHOT, // interagit avec WORLD + ENEMY, PAS avec lui-même
      );
      // COLLISION_GROUPS.PLAYER_SHOT filtre CE côté-ci pour interagir avec
      // WORLD — donc ce cas touche bien le mur : sert de garde-fou que les
      // paramètres de groupe sont bien transmis (pas ignorés/mal ordonnés).
      assert.isNotNull(hit);

      // Un filtre qui ne déclare AUCUNE interaction avec WORLD ne doit rien
      // toucher : bit de filtre à 0 mais membership WORLD (ne peut interagir
      // avec personne, y compris WORLD).
      const neverInteracts = ((COLLISION_GROUPS.WORLD >>> 16) << 16) >>> 0; // membership WORLD, filtre vide
      const hitNever = yield* raycast.castRay(
        physics,
        ray,
        20,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        neverInteracts,
      );
      assert.isNull(hitNever);
    }).pipe(Effect.provide(RaycastService.layer)),
  );

  it.effect("castRayAndGetNormal renvoie une normale et un collider cohérents", () =>
    Effect.gen(function* () {
      const { physics, collider } = buildWallWorld();
      const raycast = yield* RaycastService;
      const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

      const hit = yield* raycast.castRayAndGetNormal(
        physics,
        ray,
        20,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        COLLISION_GROUPS.WORLD,
      );

      assert.isNotNull(hit);
      assert.strictEqual(hit!.collider.handle, collider.handle);
      assert.approximately(hit!.timeOfImpact, 9, 1e-6);
      // La normale de la face touchée (perpendiculaire à z, tournée vers le rayon) pointe vers -z.
      assert.approximately(hit!.normal.z, -1, 1e-6);
    }).pipe(Effect.provide(RaycastService.layer)),
  );

  it.effect("castRayAndGetNormal renvoie null si rien n'est touché", () =>
    Effect.gen(function* () {
      const { physics } = buildWallWorld();
      const raycast = yield* RaycastService;
      // Rayon qui part dans la direction opposée au mur.
      const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });

      const hit = yield* raycast.castRayAndGetNormal(
        physics,
        ray,
        20,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        COLLISION_GROUPS.WORLD,
      );

      assert.isNull(hit);
    }).pipe(Effect.provide(RaycastService.layer)),
  );

  it.effect("intersectionsWithShape trouve le collider chevauché par une capsule", () =>
    Effect.gen(function* () {
      const { physics, collider } = buildWallWorld();
      const raycast = yield* RaycastService;
      // Capsule centrée sur le mur (z=10) : doit le chevaucher.
      const capsule = new RAPIER.Capsule(1, 0.5);

      const hits = yield* raycast.intersectionsWithShape(
        physics,
        { x: 0, y: 0, z: 10 },
        { x: 0, y: 0, z: 0, w: 1 },
        capsule,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        COLLISION_GROUPS.PLAYER_SHOT,
      );

      assert.strictEqual(hits.length, 1);
      assert.strictEqual(hits[0]!.handle, collider.handle);
    }).pipe(Effect.provide(RaycastService.layer)),
  );

  it.effect("intersectionsWithShape renvoie un tableau vide si rien n'est chevauché", () =>
    Effect.gen(function* () {
      const { physics } = buildWallWorld();
      const raycast = yield* RaycastService;
      // Capsule loin du mur (z=10) : ne doit rien chevaucher.
      const capsule = new RAPIER.Capsule(1, 0.5);

      const hits = yield* raycast.intersectionsWithShape(
        physics,
        { x: 0, y: 0, z: -50 },
        { x: 0, y: 0, z: 0, w: 1 },
        capsule,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        COLLISION_GROUPS.PLAYER_SHOT,
      );

      assert.deepStrictEqual(hits, []);
    }).pipe(Effect.provide(RaycastService.layer)),
  );
});

describe("RaycastService.test (jalon M3) — Layer scriptée, sans monde Rapier (réutilisable M5)", () => {
  it.effect("par défaut, aucune méthode ne prétend toucher quoi que ce soit", () =>
    Effect.gen(function* () {
      const raycast = yield* RaycastService;
      const dummyPhysics = null as unknown as PhysicsWorld; // jamais déréférencé : la Layer de test n'y touche pas.
      const dummyRay = null as unknown as RAPIER.Ray;

      const rayHit = yield* raycast.castRay(dummyPhysics, dummyRay, 10, true);
      const normalHit = yield* raycast.castRayAndGetNormal(dummyPhysics, dummyRay, 10, true);
      const shapeHits = yield* raycast.intersectionsWithShape(
        dummyPhysics,
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0, w: 1 },
        null as unknown as RAPIER.Shape,
      );

      assert.isNull(rayHit);
      assert.isNull(normalHit);
      assert.deepStrictEqual(shapeHits, []);
    }).pipe(Effect.provide(RaycastService.test())),
  );

  it.effect("un override scripte un résultat précis, sans jamais toucher Rapier", () => {
    const scriptedHit = { collider: { handle: 42 }, timeOfImpact: 3 } as unknown as RAPIER.RayColliderHit;

    return Effect.gen(function* () {
      const raycast = yield* RaycastService;
      const hit = yield* raycast.castRay(
        null as unknown as PhysicsWorld,
        null as unknown as RAPIER.Ray,
        10,
        true,
      );

      assert.strictEqual(hit, scriptedHit);
    }).pipe(Effect.provide(RaycastService.test({ castRay: () => Effect.succeed(scriptedHit) })));
  });
});
