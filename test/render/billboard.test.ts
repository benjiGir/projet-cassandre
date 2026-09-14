import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { BillboardSprite } from "../../src/render/billboard";

function normalesDe(sprite: BillboardSprite): THREE.Vector3[] {
  const n = sprite.mesh.geometry.attributes.normal!;
  return Array.from({ length: n.count }, (_, i) => new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i)));
}

describe("BillboardSprite — normales", () => {
  it("par défaut, la normale regarde la caméra (+Z local)", () => {
    const sprite = new BillboardSprite(new THREE.Scene(), new THREE.Texture());
    for (const n of normalesDe(sprite)) expect(n.toArray()).toEqual([0, 0, 1]);
  });

  it("`normalTilt` incline toutes les normales vers le haut, unitaires, sans toucher la géométrie", () => {
    const droit = new BillboardSprite(new THREE.Scene(), new THREE.Texture());
    const incline = new BillboardSprite(new THREE.Scene(), new THREE.Texture(), { normalTilt: Math.PI / 4 });

    for (const n of normalesDe(incline)) {
      expect(n.x).toBeCloseTo(0);
      expect(n.y).toBeCloseTo(Math.SQRT1_2);
      expect(n.z).toBeCloseTo(Math.SQRT1_2);
      expect(n.length()).toBeCloseTo(1);
    }
    expect(incline.mesh.geometry.attributes.position!.array).toEqual(droit.mesh.geometry.attributes.position!.array);
  });
});
