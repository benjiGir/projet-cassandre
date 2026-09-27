/**
 * Préfixe `ecran_*` (chantier « Les coulisses », système 2) — même trame que
 * `vitres.test.ts` : chargement réel (`buildLevelFromGltf`), fusion pure
 * (`mergeEcranDecor`), `EcranSystem` (boucle d'animation par UV, casse par PV).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { initPhysics, PhysicsWorld } from "../../../src/physics/world";
import { buildLevelFromGltf } from "../../../src/game/level/loader";
import { mergeEcranDecor, EcranSystem, type EcranCandidate } from "../../../src/game/level/ecrans";
import type { HitEvent } from "../../../src/game/player/weapons";
import { weaponConfig } from "../../../src/game/player/weaponConfig";

await initPhysics();

function lambertMat(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: 0xffffff });
}

function ecranMesh(name: string, at: THREE.Vector3, extras: Record<string, unknown> = {}) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lambertMat());
  mesh.name = name;
  mesh.position.copy(at);
  mesh.userData = { chaine: "mire", ...extras };
  return mesh;
}

function build(objects: THREE.Object3D[]) {
  const physics = new PhysicsWorld();
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  for (const obj of objects) group.add(obj);
  const handle = buildLevelFromGltf({ scene: group, animations: [] } as unknown as GLTF, scene, physics);
  return { handle, scene, physics };
}

function ecranWarnings(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls.map((call: unknown[]) => String(call[0])).filter((msg: string) => msg.includes("(ecran_*)"));
}

function hitFrom(colliderHandle: number, point: THREE.Vector3, normal = new THREE.Vector3(1, 0, 0)): HitEvent {
  return { point, normal, material: "concrete", weapon: "pistol", colliderHandle, distance: 3 };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("chargement d'un ecran_*", () => {
  it("lit `chaine`, collider WORLD fixe posé sur sa bbox, incassable sans `pv`", () => {
    const { handle } = build([ecranMesh("ecran_journal", new THREE.Vector3(0, 1, 0), { chaine: "journal" })]);
    expect(handle.stats.ecranCount).toBe(1);
    const ecran = handle.ecrans[0]!;
    expect(ecran.chaine).toBe("journal");
    expect(ecran.maxHp).toBeNull();
    expect(ecran.collider.isEnabled()).toBe(true);
  });

  it("avertit bruyamment sur une `chaine` inconnue, repli sur la valeur par défaut", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handle } = build([ecranMesh("ecran_x", new THREE.Vector3(0, 1, 0), { chaine: "telenovela" })]);
    expect(handle.ecrans[0]!.chaine).toBe("mire");
    expect(ecranWarnings(errorSpy)).toHaveLength(1);
  });

  it("lit `pv`", () => {
    const { handle } = build([ecranMesh("ecran_tv", new THREE.Vector3(0, 1, 0), { pv: 12 })]);
    expect(handle.ecrans[0]!.maxHp).toBe(12);
  });

  it("un lot de dessin pour tout le niveau, quel que soit le nombre d'écrans", () => {
    const { handle } = build([
      ecranMesh("ecran_1", new THREE.Vector3(0, 1, 0)),
      ecranMesh("ecran_2", new THREE.Vector3(2, 1, 0)),
      ecranMesh("ecran_3", new THREE.Vector3(4, 1, 0)),
    ]);
    expect(handle.stats.ecranCount).toBe(3);
    expect(handle.stats.ecranBatchCount).toBe(1);
  });
});

describe("mergeEcranDecor — un lot par matériau", () => {
  function candidate(name: string, at: THREE.Vector3): EcranCandidate {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial());
    mesh.name = name;
    mesh.position.copy(at);
    mesh.updateMatrixWorld(true);
    return { name, mesh, collider: null as never, body: null as never, maxHp: null, chaine: "mire", extras: {} };
  }

  it("deux écrans du même matériau fusionnent en UN lot, plages disjointes", () => {
    const root = new THREE.Object3D();
    root.updateMatrixWorld(true);
    const a = candidate("ecran_a", new THREE.Vector3(0, 1, 0));
    const b = candidate("ecran_b", new THREE.Vector3(2, 1, 0));
    const result = mergeEcranDecor(root, [a, b]);
    expect(result.batchCount).toBe(1);
    expect(result.ecrans[0]!.batchGeometry).toBe(result.ecrans[1]!.batchGeometry);
    expect(result.ecrans[1]!.vertexStart).toBe(result.ecrans[0]!.vertexCount);
  });

  it("un écran seul de son matériau reste passthrough sur sa propre géométrie", () => {
    const root = new THREE.Object3D();
    root.updateMatrixWorld(true);
    const a = candidate("ecran_seul", new THREE.Vector3(0, 1, 0));
    const result = mergeEcranDecor(root, [a]);
    expect(result.batchCount).toBe(0);
    expect(result.ecrans[0]!.batchGeometry).toBe(a.mesh.geometry);
  });
});

describe("EcranSystem — boucle d'animation et casse", () => {
  it("change l'UV de la plage de l'écran quand l'horloge dépasse la durée de frame (mire : 0.35 s)", () => {
    const { handle } = build([ecranMesh("ecran_mire", new THREE.Vector3(0, 1, 0), { chaine: "mire" })]);
    const ecrans = new EcranSystem(handle.ecrans);
    const info = handle.ecrans[0]!;
    const uv = info.batchGeometry.getAttribute("uv") as THREE.BufferAttribute;
    const before = [uv.getX(info.vertexStart), uv.getY(info.vertexStart)];

    ecrans.update(0.2, []);
    expect([uv.getX(info.vertexStart), uv.getY(info.vertexStart)]).toEqual(before); // pas encore assez de temps

    ecrans.update(0.2, []); // total 0.4 s > 0.35 s
    expect([uv.getX(info.vertexStart), uv.getY(info.vertexStart)]).not.toEqual(before);
  });

  it("casse au passage à zéro PV : bascule sur la chaîne interne 'casse', collider désactivé", () => {
    const pv = weaponConfig.pistolDamage;
    const { handle } = build([ecranMesh("ecran_tv", new THREE.Vector3(0, 1, 0), { chaine: "journal", pv })]);
    const ecrans = new EcranSystem(handle.ecrans);
    const colliderHandle = handle.ecrans[0]!.collider.handle;

    ecrans.update(0, [hitFrom(colliderHandle, new THREE.Vector3(0, 1, 0))]);

    expect(ecrans.destroyedEvents).toHaveLength(1);
    expect(handle.ecrans[0]!.collider.isEnabled()).toBe(true); // la casse n'affecte pas la collision, seulement l'affichage

    // Un pas suivant ne redéclenche rien.
    ecrans.clearFrameEvents();
    ecrans.update(0, [hitFrom(colliderHandle, new THREE.Vector3(0, 1, 0))]);
    expect(ecrans.hitEvents).toHaveLength(0);
  });

  it("ne relit pas le même impact lors d'un second pas fixe de la même frame", () => {
    const pv = weaponConfig.pistolDamage * 3;
    const { handle } = build([ecranMesh("ecran_tv", new THREE.Vector3(0, 1, 0), { pv })]);
    const ecrans = new EcranSystem(handle.ecrans);
    const colliderHandle = handle.ecrans[0]!.collider.handle;
    const frameHits = [hitFrom(colliderHandle, new THREE.Vector3(0, 1, 0))];

    ecrans.update(0, frameHits);
    ecrans.update(0, frameHits);

    expect(ecrans.hitEvents).toHaveLength(1);
  });
});
