// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { FxSystem } from "../../../src/render/fx/fx";

describe("FxSystem.resetSession", () => {
  beforeEach(() => {
    // jsdom fournit le DOM, mais pas le dessin 2D des textures procédurales.
    const context = {
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    } satisfies Pick<
      CanvasRenderingContext2D,
      "fillRect" | "strokeRect" | "beginPath" | "moveTo" | "lineTo" | "stroke"
    >;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retire les effets transitoires et annule le screenshake", () => {
    const scene = new THREE.Scene();
    const fx = new FxSystem(scene);
    fx.setRandom(() => 0.5);
    const baseChildren = scene.children.length;
    const point = new THREE.Vector3();
    const normal = new THREE.Vector3(0, 1, 0);

    fx.triggerShake(0.4, 1);
    fx.spawnImpactParticles(point, normal, "pistol", "wall");
    expect(scene.children.length).toBeGreaterThan(baseChildren);
    expect(fx.currentShakeOffset(new THREE.Vector3()).lengthSq()).toBeGreaterThan(0);

    fx.resetSession();

    expect(scene.children.length).toBe(baseChildren);
    expect(fx.currentShakeOffset(new THREE.Vector3())).toEqual(new THREE.Vector3());
  });
});
