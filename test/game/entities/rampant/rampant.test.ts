/**
 * Le Rampant hors de la machine d'état (lot B4) : il passe par le
 * gestionnaire du Costard avec sa propre configuration, et se pose dans un
 * niveau par le préfixe `spawn_rampant_*`. Son comportement est testé avec la
 * machine partagée, dans `test/game/entities/suit/suit.test.ts`.
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { rampantConfig } from "../../../../src/game/entities/rampant/rampantConfig";
import { suitConfig } from "../../../../src/game/entities/suit/suitConfig";
import { SuitManager } from "../../../../src/game/entities/suit/suitManager";
import { buildLevelFromGltf } from "../../../../src/game/level/loading/loader";
import { initPhysics, PhysicsWorld } from "../../../../src/physics/world";

await initPhysics();

describe("SuitManager — espèces", () => {
  it("un Rampant naît avec sa configuration, un Costard avec celle du gestionnaire", () => {
    const manager = new SuitManager(new PhysicsWorld());

    const costard = manager.spawnSuit(0, 0, 0);
    const rampant = manager.spawnSuit(4, 0, 0, new THREE.Vector3(0, 0, 1), "rampant");

    expect(costard.kind).toBe("costard");
    expect(costard.cfg).toBe(suitConfig);
    expect(rampant.kind).toBe("rampant");
    expect(rampant.cfg).toBe(rampantConfig);
    expect(rampant.hp).toBe(rampantConfig.maxHp);
    expect(manager.suits).toEqual([costard, rampant]);
  });

  it("un tir du joueur le trouve et le tue comme un Costard : la mort rejoint la même file", () => {
    const physics = new PhysicsWorld();
    const manager = new SuitManager(physics);
    const rampant = manager.spawnSuit(0, 0, 0, new THREE.Vector3(0, 0, 1), "rampant");
    const impact = {
      point: rampant.position.clone(),
      normal: new THREE.Vector3(0, 0, 1),
      material: "flesh",
      weapon: "pistol" as const,
      colliderHandle: rampant.collider!.handle,
      distance: 8,
    };

    manager.update(1 / 60, new THREE.Vector3(0, 0, 50), new THREE.Vector3(0, 1.6, 50), [impact, impact]);

    expect(rampant.isAlive).toBe(false);
    expect(manager.deathEvents.map((e) => e.suit)).toEqual([rampant]);
  });

  it("le souffle d'une explosion le prend aussi", () => {
    const manager = new SuitManager(new PhysicsWorld());
    const rampant = manager.spawnSuit(1, 0, 0, new THREE.Vector3(0, 0, 1), "rampant");

    manager.applyBlast(
      new THREE.Vector3(0, 0.6, 0),
      () => 60,
      () => true,
      2.5,
    );

    expect(rampant.isAlive).toBe(false);
  });
});

describe("Convention glTF `spawn_rampant_*`", () => {
  function build(objects: THREE.Object3D[]) {
    const group = new THREE.Group();
    for (const obj of objects) group.add(obj);
    return buildLevelFromGltf(
      { scene: group, animations: [] } as unknown as GLTF,
      new THREE.Scene(),
      new PhysicsWorld(),
    );
  }
  function empty(name: string, x: number, extras: Record<string, unknown> = {}) {
    const obj = new THREE.Object3D();
    obj.name = name;
    obj.position.set(x, 0, 0);
    Object.assign(obj.userData, extras);
    return obj;
  }

  it("rejoint la liste des apparitions du Costard, avec son espèce et son `groupe`", () => {
    const handle = build([
      empty("spawn_player", 0),
      empty("spawn_suit_a", 3),
      empty("spawn_rampant_a", 6),
      empty("spawn_rampant_meute", 9, { groupe: "livraison" }),
    ]);

    expect(handle.spawnSuits.map((s) => [s.name, s.kind ?? "costard", s.group])).toEqual([
      ["spawn_suit_a", "costard", null],
      ["spawn_rampant_a", "rampant", null],
      ["spawn_rampant_meute", "rampant", "livraison"],
    ]);
  });
});
