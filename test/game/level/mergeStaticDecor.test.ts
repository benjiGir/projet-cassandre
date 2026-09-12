import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { initPhysics, PhysicsWorld } from "../../../src/physics/world";
import { buildLevelFromGltf } from "../../../src/game/level/loader";
import { DECOR_CELL_SIZE, mergeStaticDecor } from "../../../src/game/level/mergeStaticDecor";

await initPhysics();

const sharedMap = new THREE.Texture();

function coloredBox(material: THREE.MeshLambertMaterial, position: [number, number, number], rgb: number): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const c = new THREE.Color(rgb);
  const colors = new Float32Array(geometry.attributes.position!.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  return mesh;
}

// Deux instances distinctes au contenu identique : c'est ce que produit `toLambert` pour deux meshes à la même texture.
function texturedMat(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ map: sharedMap, vertexColors: true });
}

describe("mergeStaticDecor", () => {
  it("fusionne les meshes de même matériau en un lot, sans perdre positions ni vertex colors", () => {
    const root = new THREE.Group();
    const a = coloredBox(texturedMat(), [0, 0, 0], 0xff0000);
    const b = coloredBox(texturedMat(), [10, 0, 0], 0x00ff00);
    const c = coloredBox(texturedMat(), [0, 0, 10], 0x0000ff);
    const other = coloredBox(new THREE.MeshLambertMaterial({ color: 0x123456, vertexColors: true }), [5, 5, 5], 0xffffff);
    root.add(a, b, c, other);
    root.updateWorldMatrix(true, true);

    const result = mergeStaticDecor(root, [a, b, c, other]);

    expect(result).toEqual({ mergedMeshCount: 3, batchCount: 1 });
    expect(root.children).toHaveLength(2);
    expect(root.children).toContain(other);
    const batch = root.children.find((o) => o !== other) as THREE.Mesh;
    expect(batch.geometry.attributes.position!.count).toBe(3 * 24);
    batch.geometry.computeBoundingBox();
    expect(batch.geometry.boundingBox!.min.toArray()).toEqual([-0.5, -0.5, -0.5]);
    expect(batch.geometry.boundingBox!.max.toArray()).toEqual([10.5, 0.5, 10.5]);
    const colors = batch.geometry.attributes.color!;
    expect([colors.getX(24), colors.getY(24), colors.getZ(24)]).toEqual([0, 1, 0]);
  });

  it("sépare en lots distincts deux groupes éloignés de plus d'une cellule", () => {
    // Sans découpe spatiale, ces quatre boîtes de même matériau feraient UN lot
    // couvrant 100 m : le tri d'écart ne l'éliminerait jamais.
    const root = new THREE.Group();
    const loin = DECOR_CELL_SIZE * 3;
    const ici = [coloredBox(texturedMat(), [0, 0, 0], 0xffffff), coloredBox(texturedMat(), [2, 0, 0], 0xffffff)];
    const ailleurs = [
      coloredBox(texturedMat(), [loin, 0, 0], 0xffffff),
      coloredBox(texturedMat(), [loin + 2, 0, 0], 0xffffff),
    ];
    root.add(...ici, ...ailleurs);
    root.updateWorldMatrix(true, true);

    const result = mergeStaticDecor(root, [...ici, ...ailleurs]);

    expect(result).toEqual({ mergedMeshCount: 4, batchCount: 2 });
    const boites = root.children.map((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry.computeBoundingBox();
      return mesh.geometry.boundingBox!;
    });
    // Chaque lot reste borné à son propre groupe : c'est ce qui rend le tri d'écart utile.
    for (const box of boites) expect(box.max.x - box.min.x).toBeCloseTo(3);
  });

  it("regroupe un mesh d'après le centre de sa boîte, pas son origine", () => {
    // Origine dans un coin, comme les pièces du kit : le sol de 40 m posé en
    // (0,0,0) a son centre en x = 20, donc la même cellule que la boîte voisine.
    const root = new THREE.Group();
    const sol = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 40), texturedMat());
    sol.geometry.translate(20, 0, 20);
    const voisine = coloredBox(texturedMat(), [20, 1, 20], 0xffffff);
    root.add(sol, voisine);
    root.updateWorldMatrix(true, true);

    // Le sol n'a pas de `color` : c'est l'attribut, pas la cellule, qui les
    // sépare — on compare donc à la même paire avec l'attribut aligné.
    const colors = new Float32Array(sol.geometry.attributes.position!.count * 3).fill(1);
    sol.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    expect(mergeStaticDecor(root, [sol, voisine])).toEqual({ mergedMeshCount: 2, batchCount: 1 });
  });

  it("laisse en place un mesh à échelle négative", () => {
    const root = new THREE.Group();
    const a = coloredBox(texturedMat(), [0, 0, 0], 0xffffff);
    const b = coloredBox(texturedMat(), [2, 0, 0], 0xffffff);
    const mirrored = coloredBox(texturedMat(), [4, 0, 0], 0xffffff);
    mirrored.scale.x = -1;
    root.add(a, b, mirrored);
    root.updateWorldMatrix(true, true);

    const result = mergeStaticDecor(root, [a, b, mirrored]);

    expect(result).toEqual({ mergedMeshCount: 2, batchCount: 1 });
    expect(root.children).toContain(mirrored);
  });
});

describe("buildLevelFromGltf — fusion du décor", () => {
  it("fusionne le décor statique mais jamais un mesh enfant d'une porte", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const spawn = new THREE.Object3D();
    spawn.name = "spawn_player";
    const shelfA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    shelfA.name = "gondole_a";
    const shelfB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    shelfB.name = "gondole_b";
    shelfB.position.x = 3;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    door.name = "door_test";
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    handle.name = "poignee";
    door.add(handle);
    const group = new THREE.Group();
    group.add(spawn, shelfA, shelfB, door);

    const level = buildLevelFromGltf({ scene: group, animations: [] } as unknown as GLTF, new THREE.Scene(), new PhysicsWorld());

    expect(level.stats.unprefixedMeshCount).toBe(3);
    expect(level.stats.decorBatchCount).toBe(2);
    expect(handle.parent).toBe(door);
    expect(shelfA.parent).toBeNull();
    vi.restoreAllMocks();
  });
});
