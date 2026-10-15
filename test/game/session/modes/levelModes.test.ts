/**
 * Modes de niveau : ce qu'un niveau construit à la main ajoute à une partie,
 * derrière un contrat que la session et la boucle appellent sans savoir quel
 * mode tourne. Ici la salle d'essai et sa balle témoin.
 */
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import type { LevelDef } from "../../../../src/game/level/catalog/levels";
import { buildGymMode } from "../../../../src/game/session/modes/gymMode";
import { disposeModeRoot } from "../../../../src/game/session/modes/levelMode";
import { buildLevelMode } from "../../../../src/game/session/modes/levelModes";
import { trainGymOf } from "../../../../src/game/session/modes/trainGymMode";
import { trainRideGymOf } from "../../../../src/game/session/modes/trainRideGymMode";
import { initPhysics, PhysicsWorld } from "../../../../src/physics/world";

await initPhysics();

const DT = 1 / 60;

function salle() {
  const scene = new THREE.Scene();
  const physics = new PhysicsWorld();
  const built = buildGymMode(scene, physics);
  const root = scene.children[0];
  const balle = root.children.find(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry,
  )!;
  return { scene, physics, root, balle, ...built };
}

describe("buildLevelMode", () => {
  it("un niveau glTF n'a pas de mode", () => {
    const niveau: LevelDef = { id: "niveau_v2", label: "Magasin", kind: "gltf", gltfName: "niveau_v2" };
    const scene = new THREE.Scene();

    expect(buildLevelMode(niveau, scene, new PhysicsWorld())).toBeNull();
    expect(scene.children).toHaveLength(0);
  });

  it("la salle d'essai est un mode, avec son point d'apparition", () => {
    const scene = new THREE.Scene();

    const built = buildLevelMode({ id: "gym", label: "Gym", kind: "gym" }, scene, new PhysicsWorld());

    expect(built).not.toBeNull();
    expect(scene.children).toHaveLength(1);
    expect(Number.isFinite(built!.spawn.y)).toBe(true);
    expect(Number.isFinite(built!.spawnYaw)).toBe(true);
  });

  it("les accès de dev ne confondent pas les modes", () => {
    const { mode } = salle();

    expect(trainGymOf({ mode })).toBeNull();
    expect(trainRideGymOf({ mode })).toBeNull();
    expect(trainGymOf({ mode: null })).toBeNull();
  });
});

describe("salle d'essai — balle témoin", () => {
  it("compte la balle parmi les entités affichées par le debug", () => {
    expect(salle().mode.entityCount).toBe(1);
  });

  it("la balle affichée suit son corps physique, interpolée entre deux pas", () => {
    const { mode, physics, balle } = salle();

    mode.snapshotPrevious?.();
    physics.step(DT);
    mode.syncFromPhysics?.();
    const apresUnPas = balle.position.clone();
    mode.interpolate?.(0, 0);
    const depart = balle.position.clone();
    mode.interpolate?.(1, 0);
    const arrivee = balle.position.clone();
    mode.interpolate?.(0.5, 0);

    expect(apresUnPas.toArray()).toEqual([0, 0, 0]);
    expect(depart.toArray()).toEqual([3, 4, 0]);
    // Lancée vers -X et +Z, elle tombe : un pas plus tard elle a bougé sur les trois axes.
    expect(arrivee.x).toBeLessThan(3);
    expect(arrivee.y).toBeLessThan(4);
    expect(arrivee.z).toBeGreaterThan(0);
    expect(balle.position.x).toBeCloseTo((depart.x + arrivee.x) / 2);
    expect(balle.position.z).toBeCloseTo((depart.z + arrivee.z) / 2);
  });

  it("`snapshotPrevious` fait de la pose courante le départ de l'interpolation suivante", () => {
    const { mode, physics, balle } = salle();
    mode.snapshotPrevious?.();
    physics.step(DT);
    mode.syncFromPhysics?.();
    mode.interpolate?.(1, 0);
    const finDuPremierPas = balle.position.clone();

    mode.snapshotPrevious?.();
    physics.step(DT);
    mode.syncFromPhysics?.();
    mode.interpolate?.(0, 0);

    expect(balle.position.toArray()).toEqual(finDuPremierPas.toArray());
  });

  it("`dispose` retire toute la salle de la scène et libère sa géométrie", () => {
    const { mode, scene, balle } = salle();
    const libere = vi.fn();
    balle.geometry.addEventListener("dispose", libere);

    mode.dispose();

    expect(scene.children).toHaveLength(0);
    expect(libere).toHaveBeenCalledTimes(1);
  });
});

describe("disposeModeRoot", () => {
  it("une libération qui échoue n'empêche ni les suivantes ni le retrait de la scène", () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    root.add(mesh);
    scene.add(root);
    const suivante = vi.fn();
    const geometrie = vi.fn();
    mesh.geometry.addEventListener("dispose", geometrie);

    expect(() =>
      disposeModeRoot(scene, root, [
        () => {
          throw new Error("panneau déjà libéré");
        },
        suivante,
      ]),
    ).toThrow("Libération incomplète du mode de niveau");

    expect(suivante).toHaveBeenCalledTimes(1);
    expect(geometrie).toHaveBeenCalledTimes(1);
    expect(scene.children).toHaveLength(0);
  });

  it("libère aussi les matériaux multiples d'un mesh", () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    const materiaux = [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()];
    const liberes = vi.fn();
    for (const materiau of materiaux) materiau.addEventListener("dispose", liberes);
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materiaux));
    scene.add(root);

    disposeModeRoot(scene, root);

    expect(liberes).toHaveBeenCalledTimes(2);
  });
});
