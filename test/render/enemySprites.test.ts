import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  createEnemyAnimationInput,
  enemySpriteQuad,
  enemySpriteRow,
  type EnemyAnimationInput,
  type EnemySpriteSheet,
} from "../../src/render/enemySprites";

/** Même disposition que `public/assets/sprites/costard.json`. */
const sheet: EnemySpriteSheet = {
  cellWidth: 160,
  cellHeight: 128,
  rows: 20,
  pixelsPerMeter: 64,
  feetFromBottom: 3,
  animations: {
    idle: { row: 0, frames: 2, fps: 1.5 },
    alert: { row: 2, frames: 2 },
    chase: { row: 4, frames: 6, metersPerCycle: 2.8 },
    aim: { row: 10, frames: 1 },
    fire: { row: 11, frames: 1, duration: 0.12 },
    stagger: { row: 12, frames: 2 },
    death: { row: 14, frames: 6 },
  },
  atlases: { humain: new THREE.Texture() },
};

function input(partial: Partial<EnemyAnimationInput>): EnemyAnimationInput {
  return { ...createEnemyAnimationInput(), ...partial };
}

describe("enemySpriteRow", () => {
  it("boucle le repos à sa cadence", () => {
    expect(enemySpriteRow(sheet, input({ pose: "idle", clock: 0 }))).toBe(0);
    expect(enemySpriteRow(sheet, input({ pose: "idle", clock: 0.7 }))).toBe(1);
    expect(enemySpriteRow(sheet, input({ pose: "idle", clock: 1.4 }))).toBe(0);
  });

  it("fait défiler la course à la distance parcourue, pas au temps", () => {
    const frameLength = 2.8 / 6;
    expect(enemySpriteRow(sheet, input({ pose: "chase", stride: 0, clock: 5 }))).toBe(4);
    expect(enemySpriteRow(sheet, input({ pose: "chase", stride: frameLength * 2.5 }))).toBe(6);
    expect(enemySpriteRow(sheet, input({ pose: "chase", stride: 2.8 + frameLength * 0.5 }))).toBe(4);
  });

  it("montre l'éclair par-dessus la course juste après un tir, puis reprend la course", () => {
    expect(enemySpriteRow(sheet, input({ pose: "chase", timeSinceShot: 0.05 }))).toBe(11);
    expect(enemySpriteRow(sheet, input({ pose: "chase", timeSinceShot: 0.2 }))).toBe(4);
  });

  it("tient la visée pendant toute la télégraphie", () => {
    expect(enemySpriteRow(sheet, input({ pose: "aim", poseTime: 0 }))).toBe(10);
    expect(enemySpriteRow(sheet, input({ pose: "aim", poseTime: 0.34 }))).toBe(10);
  });

  it("étale la mort sur sa durée, sans jamais déborder sur la ligne suivante", () => {
    expect(enemySpriteRow(sheet, input({ pose: "death", poseTime: 0, poseDuration: 0.72 }))).toBe(14);
    expect(enemySpriteRow(sheet, input({ pose: "death", poseTime: 0.36, poseDuration: 0.72 }))).toBe(17);
    expect(enemySpriteRow(sheet, input({ pose: "death", poseTime: 5, poseDuration: 0.72 }))).toBe(19);
    expect(enemySpriteRow(sheet, input({ pose: "corpse" }))).toBe(19);
  });

  it("ignore l'éclair pendant la mort", () => {
    expect(enemySpriteRow(sheet, input({ pose: "death", poseTime: 0, poseDuration: 0.72, timeSinceShot: 0 }))).toBe(14);
  });
});

describe("enemySpriteQuad", () => {
  it("pose la ligne des pieds de l'atlas sur le bas de la capsule", () => {
    const capsuleBottom = 0.91; // demi-hauteur 0,5 + rayon 0,4 + offset 0,01
    const quad = enemySpriteQuad(sheet, capsuleBottom);

    expect(quad.width).toBeCloseTo(2.5);
    expect(quad.height).toBeCloseTo(2);
    // Bas du quad sous le centre de la capsule = capsule + 3 px de marge.
    expect(quad.verticalAnchor * quad.height).toBeCloseTo(capsuleBottom + 3 / 64);
  });
});
