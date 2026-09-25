/**
 * `handleEnemyShotMiss` (`enemyMachine.ts`) — effet Duke Nukem voulu par le
 * contrat de `vitre_*`/`sanitaire_*` (ADR 0031/0032) : un rayon d'attaque
 * ennemi qui rate le joueur mais touche une cible cassable au passage la
 * casse.
 *
 * Fonction PURE, testée directement (sans machine à états ni PRNG de jitter à
 * faire atterrir sur le bon pixel) — voir sa doc de tête pour pourquoi elle a
 * été extraite du corps de `resolveAttack`, et pourquoi elle prend
 * maintenant PLUSIEURS cibles cassables (`BreakableHitTarget[]`) plutôt
 * qu'une seule : `VitreSystem` et `SanitaireSystem` satisfont toutes deux la
 * même interface structurelle, généralisée plutôt que dupliquée.
 */
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

import { handleEnemyShotMiss, type BreakableHitTarget } from "../../../src/game/entities/enemyMachine";

function fakeCollider(handle: number): RAPIER.Collider {
  return { handle } as unknown as RAPIER.Collider;
}

function fakeTarget(result: boolean): { target: BreakableHitTarget; tryBreak: ReturnType<typeof vi.fn> } {
  const tryBreak = vi.fn().mockReturnValue(result);
  return { target: { tryBreakByColliderHandle: tryBreak }, tryBreak };
}

describe("handleEnemyShotMiss", () => {
  it("casse la cible touchée quand le rayon ne touche PAS le joueur", () => {
    const { target: vitreSystem, tryBreak } = fakeTarget(true);
    const point = new THREE.Vector3(1, 2, 3);
    const direction = new THREE.Vector3(0, 0, 1);

    handleEnemyShotMiss([vitreSystem], fakeCollider(7), false, point, direction);

    expect(tryBreak).toHaveBeenCalledTimes(1);
    expect(tryBreak).toHaveBeenCalledWith(7, point, direction);
  });

  it("ne fait RIEN si le rayon a touché le joueur — un vrai coup ne casse pas de cible imaginaire", () => {
    const { target: vitreSystem, tryBreak } = fakeTarget(true);

    handleEnemyShotMiss([vitreSystem], fakeCollider(7), true, new THREE.Vector3(), new THREE.Vector3(0, 0, 1));

    expect(tryBreak).not.toHaveBeenCalled();
  });

  it("ne plante jamais sans aucune cible (gym, aucun niveau glTF chargé)", () => {
    expect(() =>
      handleEnemyShotMiss([undefined, undefined], fakeCollider(7), false, new THREE.Vector3(), new THREE.Vector3(0, 0, 1)),
    ).not.toThrow();
    expect(() =>
      handleEnemyShotMiss([], fakeCollider(7), false, new THREE.Vector3(), new THREE.Vector3(0, 0, 1)),
    ).not.toThrow();
  });

  it("plusieurs cibles : la première qui casse quelque chose arrête la recherche", () => {
    const { target: vitreSystem, tryBreak: tryBreakVitre } = fakeTarget(true);
    const { target: sanitaireSystem, tryBreak: tryBreakSanitaire } = fakeTarget(true);

    handleEnemyShotMiss([vitreSystem, sanitaireSystem], fakeCollider(9), false, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));

    expect(tryBreakVitre).toHaveBeenCalledTimes(1);
    expect(tryBreakSanitaire).not.toHaveBeenCalled();
  });

  it("une vitre qui ne reconnaît pas le collider laisse la chance au sanitaire suivant", () => {
    const { target: vitreSystem, tryBreak: tryBreakVitre } = fakeTarget(false);
    const { target: sanitaireSystem, tryBreak: tryBreakSanitaire } = fakeTarget(true);
    const point = new THREE.Vector3(4, 0, 4);
    const direction = new THREE.Vector3(1, 0, 0);

    handleEnemyShotMiss([vitreSystem, sanitaireSystem], fakeCollider(11), false, point, direction);

    expect(tryBreakVitre).toHaveBeenCalledTimes(1);
    expect(tryBreakSanitaire).toHaveBeenCalledTimes(1);
    expect(tryBreakSanitaire).toHaveBeenCalledWith(11, point, direction);
  });

  it("aucune cible ne reconnaît le collider : aucun effet, pas d'exception", () => {
    const { target: vitreSystem, tryBreak: tryBreakVitre } = fakeTarget(false);
    const { target: sanitaireSystem, tryBreak: tryBreakSanitaire } = fakeTarget(false);

    expect(() =>
      handleEnemyShotMiss([vitreSystem, sanitaireSystem], fakeCollider(13), false, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)),
    ).not.toThrow();
    expect(tryBreakVitre).toHaveBeenCalledTimes(1);
    expect(tryBreakSanitaire).toHaveBeenCalledTimes(1);
  });
});
