/**
 * Préfixe `vitre_*` (ADR 0031) — trois familles de tests, comme
 * `props.test.ts` : le chargement RÉEL (`buildLevelFromGltf`, warnings/
 * collider/`solide: false`), la fusion PURE par cellule (`mergeVitreDecor`,
 * en THREE.js seul), et `VitreSystem` (casse par PV, écrasement de la plage
 * de sommets, effet Duke Nukem du tir ennemi).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { initPhysics, PhysicsWorld } from "../../../src/physics/world";
import { buildLevelFromGltf } from "../../../src/game/level/loader";
import { mergeVitreDecor, VitreSystem, type VitreCandidate } from "../../../src/game/level/vitres";
import type { HitEvent } from "../../../src/game/player/weapons";
import { weaponConfig } from "../../../src/game/player/weaponConfig";

await initPhysics();

function whiteMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
}

function vitreMesh(name: string, size: THREE.Vector3, at: THREE.Vector3, extras: Record<string, unknown> = {}) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), whiteMat());
  mesh.name = name;
  mesh.position.copy(at);
  mesh.userData = { ...extras };
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

/** Les messages `vitre_*` seulement — un fixture sans `spawn_player` en produit un autre, sans rapport. */
function vitreWarnings(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls.map((call: unknown[]) => String(call[0])).filter((msg: string) => msg.includes("(vitre_*)"));
}

function hitFrom(colliderHandle: number, point: THREE.Vector3, normal = new THREE.Vector3(1, 0, 0)): HitEvent {
  return { point, normal, material: "concrete", weapon: "pistol", colliderHandle, distance: 3 };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("chargement d'un vitre_*", () => {
  it("collider cuboid actif par défaut, groupe WORLD, matériau double face sans écriture de profondeur", () => {
    const { handle } = build([vitreMesh("vitre_baie", new THREE.Vector3(2, 2), new THREE.Vector3(0, 1, 0))]);
    expect(handle.stats.vitreCount).toBe(1);
    const vitre = handle.vitres[0]!;
    expect(vitre.collider).not.toBeNull();
    expect(vitre.collider!.isEnabled()).toBe(true);
    expect(vitre.maxHp).toBeNull(); // pv absent -> incassable, mais SOLIDE (collider posé)

    const mesh = handle.root.getObjectByName("vitre_baie") as THREE.Mesh | undefined;
    const material = (mesh?.material ?? handle.root.children[0]) as THREE.MeshLambertMaterial;
    expect(material.side).toBe(THREE.DoubleSide);
    expect(material.depthWrite).toBe(false);
    expect(material.transparent).toBe(true);
  });

  it("`solide: false` : AUCUN collider, incassable — une verrière au plafond", () => {
    const { handle } = build([
      vitreMesh("vitre_verriere", new THREE.Vector3(3, 3), new THREE.Vector3(0, 4, 0), { solide: false, pv: 30 }),
    ]);
    const vitre = handle.vitres[0]!;
    expect(vitre.collider).toBeNull();
    expect(vitre.maxHp).toBeNull(); // `pv` ignoré : solide:false force incassable
  });

  it("lit `pv` et `givre`", () => {
    const { handle } = build([
      vitreMesh("vitre_surgeles", new THREE.Vector3(1, 1.5), new THREE.Vector3(0, 1, 0), { pv: 24, givre: true }),
    ]);
    const vitre = handle.vitres[0]!;
    expect(vitre.maxHp).toBe(24);
    expect(vitre.givre).toBe(true);
  });

  it("avertit bruyamment sur un `pv` invalide, sans refuser la vitre (incassable)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handle } = build([
      vitreMesh("vitre_cassee", new THREE.Vector3(1, 1), new THREE.Vector3(0, 1, 0), { pv: -5 }),
    ]);
    expect(handle.vitres).toHaveLength(1);
    expect(handle.vitres[0]!.maxHp).toBeNull();
    const warnings = vitreWarnings(errorSpy);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("pv");
  });

  it("un lot de dessin par cellule, quel que soit le nombre de vitres qui la partagent", () => {
    const { handle } = build([
      vitreMesh("vitre_1", new THREE.Vector3(1, 1), new THREE.Vector3(0, 1, 0)),
      vitreMesh("vitre_2", new THREE.Vector3(1, 1), new THREE.Vector3(2, 1, 0)),
      vitreMesh("vitre_3", new THREE.Vector3(1, 1), new THREE.Vector3(4, 1, 0)),
    ]);
    expect(handle.stats.vitreCount).toBe(3);
    expect(handle.stats.vitreBatchCount).toBe(1); // même cellule (48m), même matériau -> un seul lot
  });
});

describe("mergeVitreDecor — un lot par matériau pour tout le niveau", () => {
  function candidate(name: string, at: THREE.Vector3): VitreCandidate {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.3 }),
    );
    mesh.name = name;
    mesh.position.copy(at);
    mesh.updateMatrixWorld(true);
    return { name, mesh, collider: null, body: null, maxHp: null, givre: false, extras: {} };
  }

  it("deux vitres de la même cellule et du même matériau fusionnent en UN lot", () => {
    const root = new THREE.Object3D();
    root.updateMatrixWorld(true);
    const a = candidate("vitre_a", new THREE.Vector3(0, 1, 0));
    const b = candidate("vitre_b", new THREE.Vector3(2, 1, 0));

    const result = mergeVitreDecor(root, [a, b]);
    expect(result.batchCount).toBe(1);
    expect(result.vitres).toHaveLength(2);
    expect(result.vitres[0]!.batchGeometry).toBe(result.vitres[1]!.batchGeometry);
    // Plages disjointes qui couvrent tout le lot.
    const [va, vb] = result.vitres;
    expect(va!.vertexStart).toBe(0);
    expect(vb!.vertexStart).toBe(va!.vertexCount);
    expect(va!.vertexCount + vb!.vertexCount).toBe(
      (result.vitres[0]!.batchGeometry.getAttribute("position") as THREE.BufferAttribute).count,
    );
  });

  it("deux vitres à 200 m l'une de l'autre fusionnent quand même : pas de cellules pour le verre", () => {
    // Découpé par cellules de 48 m, le verre du niveau v2 coûtait jusqu'à six
    // lots dans une seule vue (spawn du parking, 2026-09-19).
    const root = new THREE.Object3D();
    root.updateMatrixWorld(true);
    const a = candidate("vitre_a", new THREE.Vector3(0, 1, 0));
    const b = candidate("vitre_loin", new THREE.Vector3(200, 1, 0));

    const result = mergeVitreDecor(root, [a, b]);
    expect(result.batchCount).toBe(1);
    expect(result.vitres[0]!.batchGeometry).toBe(result.vitres[1]!.batchGeometry);
  });

  it("une vitre seule de son matériau reste sur sa propre géométrie (passthrough)", () => {
    const root = new THREE.Object3D();
    root.updateMatrixWorld(true);
    const a = candidate("vitre_seule", new THREE.Vector3(0, 1, 0));
    const result = mergeVitreDecor(root, [a]);
    expect(result.batchCount).toBe(0);
    expect(result.vitres[0]!.batchGeometry).toBe(a.mesh.geometry);
    expect(result.vitres[0]!.vertexCount).toBe((a.mesh.geometry.getAttribute("position") as THREE.BufferAttribute).count);
  });
});

describe("VitreSystem — casse par PV (tir du joueur)", () => {
  const pv = weaponConfig.pistolDamage * 2;

  it("ne relit pas le même impact lors d'un second pas fixe de la même frame", () => {
    const { handle } = build([vitreMesh("vitre_a", new THREE.Vector3(1, 1), new THREE.Vector3(0, 1, 0), { pv })]);
    const vitres = new VitreSystem(handle.vitres);
    const colliderHandle = handle.vitres[0]!.collider!.handle;
    const accumulatedFrameHits = [hitFrom(colliderHandle, new THREE.Vector3(0, 1, 0))];

    vitres.update(accumulatedFrameHits);
    vitres.update(accumulatedFrameHits);

    expect(vitres.hitEvents).toHaveLength(1);
    expect(vitres.intactCount).toBe(1);
  });

  it("casse exactement au passage à zéro PV, écrase SA plage de sommets uniquement", () => {
    const { handle } = build([
      vitreMesh("vitre_a", new THREE.Vector3(1, 1), new THREE.Vector3(0, 1, 0), { pv }),
      vitreMesh("vitre_b", new THREE.Vector3(1, 1), new THREE.Vector3(2, 1, 0), { pv }),
    ]);
    expect(handle.stats.vitreBatchCount).toBe(1); // même lot -> le test porte vraiment sur l'écrasement partiel

    const vitres = new VitreSystem(handle.vitres);
    const a = handle.vitres.find((v) => v.name === "vitre_a")!;
    const b = handle.vitres.find((v) => v.name === "vitre_b")!;
    const position = a.batchGeometry.getAttribute("position") as THREE.BufferAttribute;
    const bBefore = Array.from({ length: b.vertexCount }, (_, i) => [
      position.getX(b.vertexStart + i),
      position.getY(b.vertexStart + i),
      position.getZ(b.vertexStart + i),
    ]);

    vitres.update([hitFrom(a.collider!.handle, new THREE.Vector3(0, 1, 0))]);
    expect(vitres.destroyedEvents).toHaveLength(0);
    vitres.clearFrameEvents();

    vitres.update([hitFrom(a.collider!.handle, new THREE.Vector3(0, 1, 0))]);
    expect(vitres.destroyedEvents).toHaveLength(1);
    expect(a.collider!.isEnabled()).toBe(false);

    // Plage de `a` ramenée sur son centre.
    for (let i = 0; i < a.vertexCount; i++) {
      expect(position.getX(a.vertexStart + i)).toBeCloseTo(a.localCenter.x, 5);
      expect(position.getY(a.vertexStart + i)).toBeCloseTo(a.localCenter.y, 5);
      expect(position.getZ(a.vertexStart + i)).toBeCloseTo(a.localCenter.z, 5);
    }
    // Plage de `b` STRICTEMENT inchangée — le lot reste un seul mesh, mais une seule vitre a cédé.
    for (let i = 0; i < b.vertexCount; i++) {
      expect(position.getX(b.vertexStart + i)).toBeCloseTo(bBefore[i]![0]!, 5);
      expect(position.getY(b.vertexStart + i)).toBeCloseTo(bBefore[i]![1]!, 5);
      expect(position.getZ(b.vertexStart + i)).toBeCloseTo(bBefore[i]![2]!, 5);
    }
  });

  it("un tir de plus sur une vitre déjà cassée ne produit plus rien", () => {
    const { handle } = build([vitreMesh("vitre_a", new THREE.Vector3(1, 1), new THREE.Vector3(0, 1, 0), { pv: 1 })]);
    const vitres = new VitreSystem(handle.vitres);
    const handleCollider = handle.vitres[0]!.collider!.handle;
    vitres.update([hitFrom(handleCollider, new THREE.Vector3(0, 1, 0))]);
    vitres.clearFrameEvents();
    vitres.update([hitFrom(handleCollider, new THREE.Vector3(0, 1, 0))]);
    expect(vitres.hitEvents).toHaveLength(0);
    expect(vitres.destroyedEvents).toHaveLength(0);
  });

  it("ignore un impact qui ne touche aucune vitre (sans collider -> jamais adressable)", () => {
    const { handle } = build([
      vitreMesh("vitre_verriere", new THREE.Vector3(2, 2), new THREE.Vector3(0, 4, 0), { solide: false, pv: 10 }),
    ]);
    const vitres = new VitreSystem(handle.vitres);
    vitres.update([hitFrom(9999, new THREE.Vector3(0, 4, 0))]);
    expect(vitres.hitEvents).toHaveLength(0);
    expect(vitres.intactCount).toBe(1);
  });
});

describe("VitreSystem — tir ENNEMI (effet Duke Nukem)", () => {
  it("tryBreakByColliderHandle casse D'UN COUP, quel que soit le pv restant", () => {
    const { handle } = build([vitreMesh("vitre_solide", new THREE.Vector3(2, 2), new THREE.Vector3(0, 1, 0), { pv: 500 })]);
    const vitres = new VitreSystem(handle.vitres);
    const collider = handle.vitres[0]!.collider!;

    const cassee = vitres.tryBreakByColliderHandle(collider.handle, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
    expect(cassee).toBe(true);
    expect(vitres.destroyedEvents).toHaveLength(1);
    expect(collider.isEnabled()).toBe(false);

    // Idempotent : une deuxième tentative sur la même vitre échoue proprement.
    expect(vitres.tryBreakByColliderHandle(collider.handle, new THREE.Vector3(), new THREE.Vector3(0, 0, 1))).toBe(false);
  });

  it("givre propagé jusqu'à l'évènement de destruction", () => {
    const { handle } = build([
      vitreMesh("vitre_surgeles", new THREE.Vector3(1, 1), new THREE.Vector3(0, 1, 0), { pv: 10, givre: true }),
    ]);
    const vitres = new VitreSystem(handle.vitres);
    vitres.tryBreakByColliderHandle(handle.vitres[0]!.collider!.handle, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
    expect(vitres.destroyedEvents[0]!.givre).toBe(true);
  });

  it("un collider inconnu (mur, prop) ne casse rien", () => {
    const { handle } = build([vitreMesh("vitre_a", new THREE.Vector3(1, 1), new THREE.Vector3(0, 1, 0), { pv: 10 })]);
    const vitres = new VitreSystem(handle.vitres);
    expect(vitres.tryBreakByColliderHandle(424242, new THREE.Vector3(), new THREE.Vector3(0, 1, 0))).toBe(false);
  });
});

describe("VitreSystem — harnais de console/test (destroyByName)", () => {
  it("casse par nom, sans tir ; refuse un nom inconnu ou déjà cassé", () => {
    const { handle } = build([vitreMesh("vitre_a", new THREE.Vector3(1, 1), new THREE.Vector3(0, 1, 0), { pv: 50 })]);
    const vitres = new VitreSystem(handle.vitres);

    expect(vitres.destroyByName("vitre_inconnue")).toBe(false);
    expect(vitres.destroyByName("vitre_a")).toBe(true);
    expect(vitres.destroyByName("vitre_a")).toBe(false);
    expect(vitres.destroyedEvents).toHaveLength(1);
  });

  it("describe() reflète PV, matière et état", () => {
    const { handle } = build([vitreMesh("vitre_a", new THREE.Vector3(1, 1), new THREE.Vector3(0, 1, 0), { pv: 10 })]);
    const vitres = new VitreSystem(handle.vitres);
    expect(vitres.describe()).toEqual([{ name: "vitre_a", hp: 10, maxHp: 10, broken: false, givre: false }]);
    vitres.destroyByName("vitre_a");
    expect(vitres.describe()[0]!.broken).toBe(true);
  });
});
