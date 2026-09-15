/**
 * Trousses de soin du niveau v2 : un `use_*` portant la propriété Blender
 * `soin`. Couvre la traversée du loader (`extras.soin` -> `UseObject.heals`)
 * et le ramassage sans touche d'`InteractionSystem.collectHeals`.
 */
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { initPhysics, PhysicsWorld } from "../../../src/physics/world";
import { buildLevelFromGltf } from "../../../src/game/level/loader";
import { HEAL_PICKUP_RADIUS, InteractionSystem, type InteractionHandlers } from "../../../src/game/level/interactive";

await initPhysics();

function build(extras: Record<string, unknown>) {
  const spawn = new THREE.Object3D();
  spawn.name = "spawn_player";
  const trousse = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial());
  trousse.name = "use_soin_caisses_1";
  Object.assign(trousse.userData, extras);
  const group = new THREE.Group();
  group.add(spawn, trousse);
  const gltf = { scene: group, animations: [] } as unknown as GLTF;
  return buildLevelFromGltf(gltf, new THREE.Scene(), new PhysicsWorld());
}

describe("Convention glTF des trousses de soin", () => {
  it("`soin` sur un use_* : l'objet rend ce nombre de PV, sans avertissement « sans cible »", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handle = build({ soin: 25 });

    expect(handle.useObjects[0].heals).toBe(25);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("valeur nulle, négative ou non numérique : avertissement bruyant, propriété ignorée", () => {
    for (const valeur of [0, -10, "beaucoup"]) {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const handle = build({ soin: valeur });

      expect(handle.useObjects[0].heals).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        `[level] "use_soin_caisses_1" (use_*) : propriété "soin" = "${valeur}", ` +
          "qui n'est pas un nombre de PV strictement positif — propriété ignorée.",
      );
      errorSpy.mockRestore();
    }
  });
});

describe("InteractionSystem.collectHeals", () => {
  it("à portée : soigne, disparaît, ne se reprend pas", () => {
    const handle = build({ soin: 25 });
    const trousse = handle.useObjects[0];
    const tryHeal = vi.fn(() => true);
    const system = new InteractionSystem();

    system.collectHeals(handle.useObjects, trousse.position.clone(), tryHeal);
    system.collectHeals(handle.useObjects, trousse.position.clone(), tryHeal);

    expect(tryHeal).toHaveBeenCalledTimes(1);
    expect(tryHeal).toHaveBeenCalledWith(25);
    expect(trousse.object.visible).toBe(false);
  });

  it("refusée (PV pleins) : reste au sol et se ramasse plus tard", () => {
    const handle = build({ soin: 25 });
    const joueur = handle.useObjects[0].position.clone();
    const system = new InteractionSystem();

    system.collectHeals(handle.useObjects, joueur, () => false);
    expect(handle.useObjects[0].object.visible).toBe(true);

    const tryHeal = vi.fn(() => true);
    system.collectHeals(handle.useObjects, joueur, tryHeal);
    expect(tryHeal).toHaveBeenCalledTimes(1);
  });

  it("hors de portée : rien", () => {
    const handle = build({ soin: 25 });
    const tryHeal = vi.fn(() => true);
    const loin = handle.useObjects[0].position.clone().add(new THREE.Vector3(HEAL_PICKUP_RADIUS + 0.1, 0, 0));

    new InteractionSystem().collectHeals(handle.useObjects, loin, tryHeal);

    expect(tryHeal).not.toHaveBeenCalled();
  });

  it("la touche E ignore une trousse, même collée au joueur", () => {
    const handle = build({ soin: 25 });
    const handlers = new Proxy({} as InteractionHandlers, { get: () => vi.fn() });
    const system = new InteractionSystem();

    system.update(true, handle.useObjects, handle.useObjects[0].position.clone(), handlers);

    expect(system.nearestInRangeName).toBeNull();
    expect(handle.useObjects[0].object.visible).toBe(true);
  });
});
