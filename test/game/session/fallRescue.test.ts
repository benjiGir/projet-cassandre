/**
 * Filet de chute (`src/game/session/fallRescue.ts`) — né du playtest du
 * 2026-09-16 : le niveau avait deux trous par lesquels on quittait le monde,
 * et rien ne rattrapait le joueur.
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { recordSafeGround, shouldRescue, RESCUE_FALL_DEPTH } from "../../../src/game/session/fallRescue";

const SOL = new THREE.Vector3(3, 1, -7);

describe("recordSafeGround", () => {
  it("mémorise un sol réellement touché", () => {
    const safe = new THREE.Vector3();

    expect(recordSafeGround(safe, SOL, true, 1)).toBe(true);
    expect(safe.equals(SOL)).toBe(true);
  });

  it("ignore un « au sol » sans collision — le piège du joueur téléporté", () => {
    // `spawn()` laisse `isGrounded` à vrai le temps d'un pas fixe, même dans
    // le vide : sans la garde, le vide deviendrait le dernier sol sûr, et le
    // filet y renverrait le joueur en boucle (constaté en test).
    const safe = new THREE.Vector3();

    expect(recordSafeGround(safe, new THREE.Vector3(0, 400, 0), true, 0)).toBe(false);
    expect(safe.lengthSq()).toBe(0);
  });

  it("ignore un joueur en l'air", () => {
    const safe = new THREE.Vector3();
    expect(recordSafeGround(safe, SOL, false, 3)).toBe(false);
  });
});

describe("shouldRescue", () => {
  it("se déclenche au-delà de la profondeur de chute", () => {
    expect(shouldRescue(SOL, new THREE.Vector3(3, SOL.y - RESCUE_FALL_DEPTH, -7), false)).toBe(true);
  });

  it("laisse tomber une chute normale du niveau", () => {
    // Le plus grand décrochement voulu fait 6 m (réserve -> souterrain).
    expect(shouldRescue(SOL, new THREE.Vector3(3, SOL.y - 6, -7), false)).toBe(false);
  });

  it("ne se déclenche jamais avant d'avoir touché un sol", () => {
    expect(shouldRescue(new THREE.Vector3(), new THREE.Vector3(0, -500, 0), false)).toBe(false);
  });

  it("ne se déclenche pas si le joueur est au sol", () => {
    expect(shouldRescue(SOL, new THREE.Vector3(3, SOL.y - 40, -7), true)).toBe(false);
  });
});
