/**
 * Sonde du décor statique (`presentation/surfaceProbe.ts`) : une tache ne se
 * pose que sur ce qui ne bougera jamais.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { describe, expect, it } from "vitest";

import type { LevelSession } from "../../../../src/game/level/loading/hotReload";
import { createStaticSurfaceProbe } from "../../../../src/game/session/presentation/surfaceProbe";
import { COLLISION_GROUPS, initPhysics, PhysicsWorld } from "../../../../src/physics/world";

await initPhysics();

const DOWN = new THREE.Vector3(0, -1, 0);

function world() {
  const physics = new PhysicsWorld();
  // Un sol statique de 20 m, dessus à y = 0.
  physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(10, 0.5, 10).setTranslation(0, -0.5, 0).setCollisionGroups(COLLISION_GROUPS.WORLD),
  );
  physics.world.step();
  return physics;
}

describe("sonde du décor statique", () => {
  it("rend le point touché et une normale tournée vers l'origine du rayon", () => {
    const physics = world();
    const probe = createStaticSurfaceProbe({ physics, gltfLevelSession: null });

    const hit = probe(new THREE.Vector3(1, 2, 3), DOWN, 5);

    expect(hit?.point.x).toBeCloseTo(1);
    expect(hit?.point.y).toBeCloseTo(0);
    expect(hit?.point.z).toBeCloseTo(3);
    expect(hit?.normal.y).toBeCloseTo(1);
    expect(probe(new THREE.Vector3(1, 2, 3), DOWN, 1)).toBeNull();
  });

  it("traverse le mobilier : un prop posé sur le sol ne reçoit pas la tache", () => {
    const physics = world();
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.5, 0));
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setCollisionGroups(COLLISION_GROUPS.PROP),
      body,
    );
    physics.world.step();
    const probe = createStaticSurfaceProbe({ physics, gltfLevelSession: null });

    expect(probe(new THREE.Vector3(0, 3, 0), DOWN, 5)?.point.y).toBeCloseTo(0, 1);
  });

  it("ignore une porte, une vitre ou un sanitaire du niveau, même fixes", () => {
    const physics = world();
    const door = physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(1, 0.1, 1).setTranslation(0, 1, 0).setCollisionGroups(COLLISION_GROUPS.WORLD),
    );
    physics.world.step();
    const level = {
      current: { doors: [{ collider: door }], vitres: [], sanitaires: [], props: [] },
    } as unknown as LevelSession;

    const through = createStaticSurfaceProbe({ physics, gltfLevelSession: level });
    expect(through(new THREE.Vector3(0, 3, 0), DOWN, 5)?.point.y).toBeCloseTo(0);
  });

  it("ne marque rien quand le rayon part de l'intérieur d'un collider", () => {
    const physics = world();
    const probe = createStaticSurfaceProbe({ physics, gltfLevelSession: null });
    expect(probe(new THREE.Vector3(0, -0.25, 0), DOWN, 5)).toBeNull();
  });
});
