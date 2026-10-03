import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { initPhysics, PhysicsWorld } from "../../../../src/physics/world";
import { buildLevelFromGltf } from "../../../../src/game/level/loading/loader";

await initPhysics();

function empty(name: string, extras: Record<string, unknown> = {}): THREE.Object3D {
  const obj = new THREE.Object3D();
  obj.name = name;
  Object.assign(obj.userData, extras);
  return obj;
}

describe("spawn_suit_* et leur groupe", () => {
  it("lit `groupe` ; un spawn sans groupe est présent dès le chargement", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const group = new THREE.Group();
    group.add(empty("spawn_player"), empty("spawn_suit_a"), empty("spawn_suit_b", { groupe: "renfort" }), empty("spawn_suit_c", { groupe: "  " }));
    const handle = buildLevelFromGltf({ scene: group, animations: [] } as unknown as GLTF, new THREE.Scene(), new PhysicsWorld());
    expect(handle.spawnSuits.map((spawn) => [spawn.name, spawn.group])).toEqual([
      ["spawn_suit_a", null],
      ["spawn_suit_b", "renfort"],
      ["spawn_suit_c", null],
    ]);
    vi.restoreAllMocks();
  });
});
