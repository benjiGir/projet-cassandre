import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { FxSystem } from "../../src/render/fx";

describe("FxSystem.resetSession", () => {
  it("retire les effets transitoires et annule le screenshake", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const scene = new THREE.Scene();
    const fx = new FxSystem(scene);
    const baseChildren = scene.children.length;
    const point = new THREE.Vector3();
    const normal = new THREE.Vector3(0, 1, 0);

    fx.triggerShake(0.4, 1);
    fx.spawnImpactParticles(point, normal, "pistol", "wall");
    expect(scene.children.length).toBeGreaterThan(baseChildren);

    fx.resetSession();

    expect(scene.children.length).toBe(baseChildren);
    expect(fx.currentShakeOffset(new THREE.Vector3())).toEqual(new THREE.Vector3());
    vi.restoreAllMocks();
  });
});
