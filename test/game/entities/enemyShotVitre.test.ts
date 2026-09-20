/**
 * `handleEnemyShotMiss` (`enemyMachine.ts`) — effet Duke Nukem voulu par le
 * contrat de `vitre_*` (ADR 0031) : un rayon d'attaque ennemi qui rate le
 * joueur mais touche une vitre au passage la casse.
 *
 * Fonction PURE, testée directement (sans machine à états ni PRNG de jitter à
 * faire atterrir sur le bon pixel) — voir sa doc de tête pour pourquoi elle a
 * été extraite du corps de `resolveAttack`.
 */
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

import { handleEnemyShotMiss, type VitreHitTarget } from "../../../src/game/entities/enemyMachine";

function fakeCollider(handle: number): RAPIER.Collider {
  return { handle } as unknown as RAPIER.Collider;
}

describe("handleEnemyShotMiss", () => {
  it("casse la vitre touchée quand le rayon ne touche PAS le joueur", () => {
    const tryBreak = vi.fn().mockReturnValue(true);
    const vitreSystem: VitreHitTarget = { tryBreakByColliderHandle: tryBreak };
    const point = new THREE.Vector3(1, 2, 3);
    const direction = new THREE.Vector3(0, 0, 1);

    handleEnemyShotMiss(vitreSystem, fakeCollider(7), false, point, direction);

    expect(tryBreak).toHaveBeenCalledTimes(1);
    expect(tryBreak).toHaveBeenCalledWith(7, point, direction);
  });

  it("ne fait RIEN si le rayon a touché le joueur — un vrai coup ne casse pas de vitre imaginaire", () => {
    const tryBreak = vi.fn().mockReturnValue(true);
    const vitreSystem: VitreHitTarget = { tryBreakByColliderHandle: tryBreak };

    handleEnemyShotMiss(vitreSystem, fakeCollider(7), true, new THREE.Vector3(), new THREE.Vector3(0, 0, 1));

    expect(tryBreak).not.toHaveBeenCalled();
  });

  it("ne plante jamais sans VitreSystem (gym, aucun niveau glTF chargé)", () => {
    expect(() =>
      handleEnemyShotMiss(undefined, fakeCollider(7), false, new THREE.Vector3(), new THREE.Vector3(0, 0, 1)),
    ).not.toThrow();
  });
});
