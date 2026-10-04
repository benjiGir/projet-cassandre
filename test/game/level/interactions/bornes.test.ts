/**
 * Convention glTF des bornes (lot B1) : un `use_*` qui porte `perk` ET `prix`
 * vend ce perk. Couvre la traversée du loader (`extras` -> `UseObject.sells`)
 * et le dispatch d'`InteractionSystem` ; l'achat est testé dans
 * `test/game/session/progression/perks.test.ts`.
 */
import { readFileSync } from "node:fs";

import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { initPhysics, PhysicsWorld } from "../../../../src/physics/world";
import { buildLevelFromGltf } from "../../../../src/game/level/loading/loader";
import { InteractionSystem, type InteractionHandlers } from "../../../../src/game/level/interactions/interactive";
import { PERKS, PERK_INFO, parsePerk } from "../../../../src/game/player/perks";

await initPhysics();

function build(extras: Record<string, unknown>) {
  const spawn = new THREE.Object3D();
  spawn.name = "spawn_player";
  const borne = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.4), new THREE.MeshStandardMaterial());
  borne.name = "use_borne_galerie";
  Object.assign(borne.userData, extras);
  const group = new THREE.Group();
  group.add(spawn, borne);
  const gltf = { scene: group, animations: [] } as unknown as GLTF;
  return buildLevelFromGltf(gltf, new THREE.Scene(), new PhysicsWorld());
}

function handlers(onPerkKioskUse: InteractionHandlers["onPerkKioskUse"]): InteractionHandlers {
  return {
    onExitDoorUse: () => {},
    onFrozenStorageUse: () => {},
    onDoorUse: () => {},
    onPaMicUse: () => {},
    onPunchClockUse: () => {},
    onSavBellUse: () => {},
    onShowerToggleUse: () => {},
    onToiletUse: () => {},
    onCardPickup: () => {},
    onCardDoorUse: () => {},
    onCameraConsoleUse: () => {},
    onPerkKioskUse,
  };
}

describe("catalogue des perks", () => {
  it("chaque identifiant a un nom de produit, un effet annoncé, et se relit depuis une custom property", () => {
    for (const perk of PERKS) {
      expect(PERK_INFO[perk].label.length).toBeGreaterThan(0);
      expect(PERK_INFO[perk].effect.length).toBeGreaterThan(0);
      expect(parsePerk(` ${perk.toUpperCase()} `)).toBe(perk);
    }
    expect(parsePerk("jetpack")).toBeNull();
    expect(parsePerk(12)).toBeNull();
  });

  it("`validate_level.py` relit exactement ces identifiants dans la source", () => {
    const source = new TextDecoder().decode(readFileSync("src/game/player/perks.ts"));
    // Même motif que `PERKS = _cles_ts(...)` dans tools/blender/validate_level.py.
    const lus = [...source.matchAll(/^  (\w+): \{ label: "/gm)].map((m) => m[1]);
    expect(lus).toEqual([...PERKS]);
  });
});

describe("Convention glTF des bornes", () => {
  it("`perk` + `prix` : l'objet vend ce perk à ce prix, sans avertissement « sans cible »", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handle = build({ perk: "gilet", prix: 100 });

    expect(handle.useObjects[0].sells).toEqual({ perk: "gilet", price: 100 });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it.each([
    [{ perk: "jetpack", prix: 20 }, "jetpack", "20"],
    [{ perk: "gilet", prix: 0 }, "gilet", "0"],
    [{ perk: "gilet", prix: "cher" }, "gilet", "cher"],
    [{ perk: "gilet" }, "gilet", ""],
    [{ prix: 20 }, "", "20"],
  ])("borne mal décrite %j : avertissement bruyant, elle ne vend rien", (extras, perk, prix) => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handle = build(extras);

    expect(handle.useObjects[0].sells).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      `[level] "use_borne_galerie" (use_*) : borne "perk" = "${perk}", "prix" = "${prix}" — ` +
        `il faut un perk connu (${PERKS.join(", ")}) ET un prix strictement positif. La borne ne vend rien.`,
    );
    errorSpy.mockRestore();
  });
});

describe("InteractionSystem — bornes", () => {
  it("à portée : la touche d'usage propose l'offre, et la borne n'est jamais consommée", () => {
    const handle = build({ perk: "premium", prix: 20 });
    const system = new InteractionSystem();
    const achat = vi.fn();
    const position = handle.useObjects[0].position.clone();

    expect(system.update(true, handle.useObjects, position, handlers(achat))).toBe(true);
    expect(system.update(true, handle.useObjects, position, handlers(achat))).toBe(true);

    expect(achat).toHaveBeenCalledTimes(2);
    expect(achat).toHaveBeenCalledWith({ perk: "premium", price: 20 });
    expect(system.nearestInRange).toBe(handle.useObjects[0]);
  });

  it("hors de portée : aucune offre visée, aucun achat", () => {
    const handle = build({ perk: "premium", prix: 20 });
    const system = new InteractionSystem();
    const achat = vi.fn();
    const loin = handle.useObjects[0].position.clone().add(new THREE.Vector3(5, 0, 0));

    expect(system.update(true, handle.useObjects, loin, handlers(achat))).toBe(false);

    expect(achat).not.toHaveBeenCalled();
    expect(system.nearestInRange).toBeNull();
  });
});
