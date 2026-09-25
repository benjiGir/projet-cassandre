/**
 * Préfixe `sanitaire_*` (ADR 0032) — mêmes trois familles de tests que
 * `vitres.test.ts`, dont ce fichier est un calque assumé : le chargement RÉEL
 * (`buildLevelFromGltf`, avertissements/collider), la fusion PURE par
 * matériau (`mergeSanitaireDecor`, en THREE.js seul), et `SanitaireSystem`
 * (casse par PV, écrasement de la plage de sommets, effet Duke Nukem du tir
 * ennemi, plus proche à portée, jets d'eau actifs).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { initPhysics, PhysicsWorld } from "../../../src/physics/world";
import { buildLevelFromGltf } from "../../../src/game/level/loader";
import {
  mergeSanitaireDecor,
  SanitaireSystem,
  type SanitaireCandidate,
} from "../../../src/game/level/sanitaires";
import type { HitEvent } from "../../../src/game/player/weapons";
import { weaponConfig } from "../../../src/game/player/weaponConfig";

await initPhysics();

/** Boîte dont l'ORIGINE est un coin, comme toute pièce du kit du projet (même piège que `props.test.ts`). */
function sanitaireMesh(name: string, size: THREE.Vector3, at: THREE.Vector3, extras: Record<string, unknown> = {}) {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  geometry.translate(size.x / 2, size.y / 2, size.z / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffffff }));
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

/** Les messages `sanitaire_*` seulement — un fixture sans `spawn_player` en produit un autre, sans rapport. */
function sanitaireWarnings(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls
    .map((call: unknown[]) => String(call[0]))
    .filter((msg: string) => msg.includes("(sanitaire_*)"));
}

function hitFrom(colliderHandle: number, point: THREE.Vector3, normal = new THREE.Vector3(1, 0, 0)): HitEvent {
  return { point, normal, material: "concrete", weapon: "pistol", colliderHandle, distance: 3 };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("chargement d'un sanitaire_*", () => {
  it("collider cuboid actif par défaut, groupe WORLD — toujours solide, contrairement à vitre_*", () => {
    const { handle } = build([
      sanitaireMesh("sanitaire_cuvette_1", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0), {
        sorte: "cuvette",
      }),
    ]);
    expect(handle.stats.sanitaireCount).toBe(1);
    const s = handle.sanitaires[0]!;
    expect(s.collider.isEnabled()).toBe(true);
    expect(s.maxHp).toBeNull(); // pv absent -> incassable au tir du joueur, mais reste utilisable
    expect(s.kind).toBe("cuvette");
  });

  it("`sorte` OBLIGATOIRE : absente -> avertissement bruyant, repli sur cuvette", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handle } = build([
      sanitaireMesh("sanitaire_wc_3", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0)),
    ]);

    expect(handle.sanitaires[0]!.kind).toBe("cuvette");
    const warnings = sanitaireWarnings(errorSpy);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("sorte");
    expect(warnings[0]).toContain("(absent)");
  });

  it("`sorte` inconnue : avertissement bruyant, repli sur cuvette", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handle } = build([
      sanitaireMesh("sanitaire_wc_4", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0), {
        sorte: "lavabo",
      }),
    ]);

    expect(handle.sanitaires[0]!.kind).toBe("cuvette");
    const warnings = sanitaireWarnings(errorSpy);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("lavabo");
  });

  it("`sorte: urinoir` reconnue, sans aucun avertissement", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handle } = build([
      sanitaireMesh("sanitaire_urinoir_1", new THREE.Vector3(0.4, 0.6, 0.3), new THREE.Vector3(2, 0, 0), {
        sorte: "urinoir",
      }),
    ]);

    expect(handle.sanitaires[0]!.kind).toBe("urinoir");
    expect(sanitaireWarnings(errorSpy)).toHaveLength(0);
  });

  it("avertit bruyamment sur un `pv` invalide, sans refuser le sanitaire (incassable au tir du joueur)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handle } = build([
      sanitaireMesh("sanitaire_cuvette_2", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0), {
        sorte: "cuvette",
        pv: -5,
      }),
    ]);
    expect(handle.sanitaires).toHaveLength(1);
    expect(handle.sanitaires[0]!.maxHp).toBeNull();
    const warnings = sanitaireWarnings(errorSpy);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("pv");
  });

  it("jetOrigin = bas-centre de la bbox MONDE de l'appareil", () => {
    const { handle } = build([
      sanitaireMesh("sanitaire_cuvette_5", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(3, 1, -2), {
        sorte: "cuvette",
      }),
    ]);
    const s = handle.sanitaires[0]!;
    // Origine au coin (3, 1, -2), boîte (0.6, 0.8, 0.7) -> centre monde (3.3, 1.4, -1.65), bas = y minimal (1).
    expect(s.jetOrigin.x).toBeCloseTo(3.3, 5);
    expect(s.jetOrigin.y).toBeCloseTo(1, 5);
    expect(s.jetOrigin.z).toBeCloseTo(-1.65, 5);
  });

  it("un lot de dessin par matériau, pour tout le niveau, quel que soit le nombre de sanitaires", () => {
    const { handle } = build([
      sanitaireMesh("sanitaire_1", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0), { sorte: "cuvette" }),
      sanitaireMesh("sanitaire_2", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(2, 0, 0), { sorte: "cuvette" }),
      sanitaireMesh("sanitaire_3", new THREE.Vector3(0.4, 0.6, 0.3), new THREE.Vector3(4, 0, 0), { sorte: "urinoir" }),
    ]);
    expect(handle.stats.sanitaireCount).toBe(3);
    expect(handle.stats.sanitaireBatchCount).toBe(1); // même matériau -> un seul lot, aucune découpe en cellules
  });
});

describe("mergeSanitaireDecor — un lot par matériau pour tout le niveau", () => {
  let nextFakeHandle = 0;

  function candidate(name: string, at: THREE.Vector3): SanitaireCandidate {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial());
    mesh.name = name;
    mesh.position.copy(at);
    mesh.updateMatrixWorld(true);
    const bottomY = at.y - 0.5;
    return {
      name,
      mesh: mesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>,
      collider: { handle: nextFakeHandle++ } as never,
      body: {} as never,
      kind: "cuvette",
      maxHp: null,
      jetOrigin: new THREE.Vector3(at.x, bottomY, at.z),
      extras: {},
    };
  }

  it("deux sanitaires du même matériau fusionnent en UN lot, même à 200 m l'un de l'autre", () => {
    // Pas de découpe en cellules pour les sanitaires — même raison que le
    // verre : une salle de toilettes pèse quelques centaines de triangles.
    const root = new THREE.Object3D();
    root.updateMatrixWorld(true);
    const a = candidate("sanitaire_a", new THREE.Vector3(0, 1, 0));
    const b = candidate("sanitaire_loin", new THREE.Vector3(200, 1, 0));

    const result = mergeSanitaireDecor(root, [a, b]);
    expect(result.batchCount).toBe(1);
    expect(result.sanitaires).toHaveLength(2);
    expect(result.sanitaires[0]!.batchGeometry).toBe(result.sanitaires[1]!.batchGeometry);
    const [sa, sb] = result.sanitaires;
    expect(sa!.vertexStart).toBe(0);
    expect(sb!.vertexStart).toBe(sa!.vertexCount);
  });

  it("un sanitaire seul de son matériau reste sur sa propre géométrie (passthrough)", () => {
    const root = new THREE.Object3D();
    root.updateMatrixWorld(true);
    const a = candidate("sanitaire_seul", new THREE.Vector3(0, 1, 0));
    const result = mergeSanitaireDecor(root, [a]);
    expect(result.batchCount).toBe(0);
    expect(result.sanitaires[0]!.batchGeometry).toBe(a.mesh.geometry);
    // Resté seul, c'est son propre mesh qui est élagué par distance.
    expect(result.rendus).toHaveLength(1);
    expect(result.rendus[0]!.object).toBe(a.mesh);
    expect(result.rendus[0]!.position.distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-6);
  });

  it("expose le lot RENDU et son centre monde, pour l'élagage par distance", () => {
    // Sans élagage, le lot de la salle des toilettes était dessiné depuis le
    // parking extérieur, à 80 m, dans la pire vue du niveau.
    const root = new THREE.Object3D();
    root.updateMatrixWorld(true);
    const a = candidate("sanitaire_a", new THREE.Vector3(60, 1, -15));
    const b = candidate("sanitaire_b", new THREE.Vector3(62, 1, -15));

    const result = mergeSanitaireDecor(root, [a, b]);
    expect(result.rendus).toHaveLength(1);
    expect(result.rendus[0]!.object.name).toMatch(/^sanitaire_fusion_/);
    expect(result.rendus[0]!.position.distanceTo(new THREE.Vector3(61, 1, -15))).toBeLessThan(1e-6);
  });
});

describe("SanitaireSystem — casse par PV (tir du joueur)", () => {
  const pv = weaponConfig.pistolDamage * 2;

  it("casse exactement au passage à zéro PV, écrase SA plage de sommets uniquement", () => {
    const { handle } = build([
      sanitaireMesh("sanitaire_a", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0), {
        sorte: "cuvette",
        pv,
      }),
      sanitaireMesh("sanitaire_b", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(2, 0, 0), {
        sorte: "cuvette",
        pv,
      }),
    ]);
    expect(handle.stats.sanitaireBatchCount).toBe(1); // même lot -> le test porte vraiment sur l'écrasement partiel

    const sanitaires = new SanitaireSystem(handle.sanitaires);
    const a = handle.sanitaires.find((s) => s.name === "sanitaire_a")!;
    const b = handle.sanitaires.find((s) => s.name === "sanitaire_b")!;
    const position = a.batchGeometry.getAttribute("position") as THREE.BufferAttribute;
    const bBefore = Array.from({ length: b.vertexCount }, (_, i) => [
      position.getX(b.vertexStart + i),
      position.getY(b.vertexStart + i),
      position.getZ(b.vertexStart + i),
    ]);

    sanitaires.update([hitFrom(a.collider.handle, new THREE.Vector3(0, 1, 0))]);
    expect(sanitaires.destroyedEvents).toHaveLength(0);
    sanitaires.clearFrameEvents();

    sanitaires.update([hitFrom(a.collider.handle, new THREE.Vector3(0, 1, 0))]);
    expect(sanitaires.destroyedEvents).toHaveLength(1);
    expect(a.collider.isEnabled()).toBe(false);

    for (let i = 0; i < a.vertexCount; i++) {
      expect(position.getX(a.vertexStart + i)).toBeCloseTo(a.localCenter.x, 5);
      expect(position.getY(a.vertexStart + i)).toBeCloseTo(a.localCenter.y, 5);
      expect(position.getZ(a.vertexStart + i)).toBeCloseTo(a.localCenter.z, 5);
    }
    for (let i = 0; i < b.vertexCount; i++) {
      expect(position.getX(b.vertexStart + i)).toBeCloseTo(bBefore[i]![0]!, 5);
      expect(position.getY(b.vertexStart + i)).toBeCloseTo(bBefore[i]![1]!, 5);
      expect(position.getZ(b.vertexStart + i)).toBeCloseTo(bBefore[i]![2]!, 5);
    }
  });

  it("un tir de plus sur un sanitaire déjà cassé ne produit plus rien", () => {
    const { handle } = build([
      sanitaireMesh("sanitaire_a", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0), {
        sorte: "cuvette",
        pv: 1,
      }),
    ]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);
    const colliderHandle = handle.sanitaires[0]!.collider.handle;
    sanitaires.update([hitFrom(colliderHandle, new THREE.Vector3(0, 1, 0))]);
    sanitaires.clearFrameEvents();
    sanitaires.update([hitFrom(colliderHandle, new THREE.Vector3(0, 1, 0))]);
    expect(sanitaires.hitEvents).toHaveLength(0);
    expect(sanitaires.destroyedEvents).toHaveLength(0);
  });

  it("un sanitaire incassable (pv absent) résiste indéfiniment au tir du joueur", () => {
    const { handle } = build([
      sanitaireMesh("sanitaire_a", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0), {
        sorte: "cuvette",
      }),
    ]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);
    const colliderHandle = handle.sanitaires[0]!.collider.handle;
    for (let i = 0; i < 50; i++) sanitaires.update([hitFrom(colliderHandle, new THREE.Vector3(0, 1, 0))]);
    expect(sanitaires.intactCount).toBe(1);
  });
});

describe("SanitaireSystem — tir ENNEMI (effet Duke Nukem)", () => {
  it("tryBreakByColliderHandle casse D'UN COUP, quel que soit le pv restant (même un sanitaire incassable au joueur)", () => {
    const { handle } = build([
      sanitaireMesh("sanitaire_solide", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0), {
        sorte: "cuvette",
      }),
    ]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);
    const collider = handle.sanitaires[0]!.collider;

    const cassee = sanitaires.tryBreakByColliderHandle(collider.handle, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
    expect(cassee).toBe(true);
    expect(sanitaires.destroyedEvents).toHaveLength(1);
    expect(collider.isEnabled()).toBe(false);

    // Idempotent : une deuxième tentative sur le même sanitaire échoue proprement.
    expect(sanitaires.tryBreakByColliderHandle(collider.handle, new THREE.Vector3(), new THREE.Vector3(0, 0, 1))).toBe(false);
  });

  it("un collider inconnu (mur, prop) ne casse rien", () => {
    const { handle } = build([
      sanitaireMesh("sanitaire_a", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0), { sorte: "cuvette" }),
    ]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);
    expect(sanitaires.tryBreakByColliderHandle(424242, new THREE.Vector3(), new THREE.Vector3(0, 1, 0))).toBe(false);
  });
});

describe("SanitaireSystem — harnais de console/test (destroyByName)", () => {
  it("casse par nom, sans tir ; refuse un nom inconnu ou déjà cassé", () => {
    const { handle } = build([
      sanitaireMesh("sanitaire_a", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0), {
        sorte: "cuvette",
        pv: 50,
      }),
    ]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);

    expect(sanitaires.destroyByName("sanitaire_inconnu")).toBe(false);
    expect(sanitaires.destroyByName("sanitaire_a")).toBe(true);
    expect(sanitaires.destroyByName("sanitaire_a")).toBe(false);
    expect(sanitaires.destroyedEvents).toHaveLength(1);
  });

  it("describe() reflète sorte, PV et état", () => {
    const { handle } = build([
      sanitaireMesh("sanitaire_a", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0), {
        sorte: "urinoir",
        pv: 10,
      }),
    ]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);
    expect(sanitaires.describe()).toEqual([{ name: "sanitaire_a", kind: "urinoir", hp: 10, maxHp: 10, broken: false }]);
    sanitaires.destroyByName("sanitaire_a");
    expect(sanitaires.describe()[0]!.broken).toBe(true);
  });
});

describe("SanitaireSystem — resolveAim (neartag de visée, ADR 0032 section « Portée — visée »)", () => {
  // Boîte monde du sanitaire de fixture : origine au coin (0,0,0), taille
  // (0.6, 0.8, 0.7) -> [0, 0.6]×[0, 0.8]×[0, 0.7]. jetOrigin (bas-centre) =
  // (0.3, 0, 0.35). Volume de visée du jet (JET_AIM_RADIUS_METERS=0.3,
  // JET_AIM_HEIGHT_METERS=1.5) : [0, 0.6]×[0, 1.5]×[0.05, 0.65].
  function unSanitaire(name = "sanitaire_a") {
    return sanitaireMesh(name, new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0), { sorte: "cuvette" });
  }

  // Rayon droit qui traverse le volume du jet EXACTEMENT : x et y constants
  // et DANS la boîte (0.3 ∈ [0,0.6], 0.75 ∈ [0,1.5]), seul z varie le long
  // de -z. Entrée dans la boîte à z=0.65 (bord le plus proche du joueur) :
  // origin.z(5.35) - 0.65 = 4.7 m pile.
  const eyeOrigin = new THREE.Vector3(0.3, 0.75, 5.35);
  const direction = new THREE.Vector3(0, 0, -1);
  const JET_ENTRY_DISTANCE = 4.7;

  it("sanitaire INTACT touché en premier par le rayon (worldHit = son propre collider) : gagne, sans regarder la géométrie du jet", () => {
    const { handle } = build([unSanitaire()]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);
    const collider = handle.sanitaires[0]!.collider;

    const aimed = sanitaires.resolveAim(eyeOrigin, direction, 6, { colliderHandle: collider.handle, distance: 1.23 });
    expect(aimed).toEqual({ name: "sanitaire_a", kind: "cuvette", broken: false });
  });

  it("worldHit pointe sur un collider INCONNU (mur, cloison) et aucun sanitaire cassé n'existe : null", () => {
    const { handle } = build([unSanitaire()]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);

    const aimed = sanitaires.resolveAim(eyeOrigin, direction, 6, { colliderHandle: 999999, distance: 1.0 });
    expect(aimed).toBeNull();
  });

  it("aucun worldHit (rien touché par le rayon) et le sanitaire est INTACT : null — rien à viser", () => {
    const { handle } = build([unSanitaire()]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);

    expect(sanitaires.resolveAim(eyeOrigin, direction, 6, null)).toBeNull();
  });

  it("sanitaire CASSÉ, rayon qui traverse le volume du jet sans obstacle WORLD (worldHit = null) : gagne", () => {
    const { handle } = build([unSanitaire()]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);
    sanitaires.destroyByName("sanitaire_a");

    const aimed = sanitaires.resolveAim(eyeOrigin, direction, 6, null);
    expect(aimed).toEqual({ name: "sanitaire_a", kind: "cuvette", broken: true });
  });

  it("sanitaire CASSÉ, portée trop courte pour atteindre le jet : null", () => {
    const { handle } = build([unSanitaire()]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);
    sanitaires.destroyByName("sanitaire_a");

    expect(sanitaires.resolveAim(eyeOrigin, direction, JET_ENTRY_DISTANCE - 0.7, null)).toBeNull();
  });

  it("sanitaire CASSÉ, rayon qui pointe À L'OPPOSÉ du jet : null", () => {
    const { handle } = build([unSanitaire()]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);
    sanitaires.destroyByName("sanitaire_a");

    const away = new THREE.Vector3(0, 0, 1); // s'éloigne du jet plutôt que de s'en approcher
    expect(sanitaires.resolveAim(eyeOrigin, away, 6, null)).toBeNull();
  });

  it("sanitaire CASSÉ, une CLOISON plus proche que le jet (pas à travers un mur) : null", () => {
    const { handle } = build([unSanitaire()]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);
    sanitaires.destroyByName("sanitaire_a");

    // Mur/cloison bien avant l'entrée du jet.
    const aimed = sanitaires.resolveAim(eyeOrigin, direction, 6, {
      colliderHandle: 424242,
      distance: JET_ENTRY_DISTANCE - 2.7,
    });
    expect(aimed).toBeNull();
  });

  it("sanitaire CASSÉ, un obstacle WORLD plus LOIN que le jet (le mur derrière l'appareil) : le jet gagne quand même", () => {
    const { handle } = build([unSanitaire()]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);
    sanitaires.destroyByName("sanitaire_a");

    // Mur derrière le jet : rien entre le joueur et le jet.
    const aimed = sanitaires.resolveAim(eyeOrigin, direction, 6, {
      colliderHandle: 424242,
      distance: JET_ENTRY_DISTANCE + 0.3,
    });
    expect(aimed).toEqual({ name: "sanitaire_a", kind: "cuvette", broken: true });
  });

  it("deux sanitaires CASSÉS visés par le même rayon : le jet le plus proche l'emporte", () => {
    // Un deuxième sanitaire plus proche du joueur, dont le jet est traversé
    // en premier (entrée < 4,7 m) : jetOrigin en (0.3, 0, 3.35), volume
    // [0,0.6]×[0,1.5]×[3.05,3.65] -> entrée à z=5.35-3.65 = 1.7 m.
    const { handle } = build([
      unSanitaire("sanitaire_loin"),
      sanitaireMesh("sanitaire_proche", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 3), {
        sorte: "cuvette",
      }),
    ]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);
    sanitaires.destroyByName("sanitaire_loin");
    sanitaires.destroyByName("sanitaire_proche");

    const aimed = sanitaires.resolveAim(eyeOrigin, direction, 6, null);
    expect(aimed?.name).toBe("sanitaire_proche");
  });

  it("aucun sanitaire dans le système : null, quel que soit le rayon", () => {
    const sanitaires = new SanitaireSystem([]);
    expect(sanitaires.resolveAim(eyeOrigin, direction, 6, null)).toBeNull();
  });
});

describe("SanitaireSystem — jets d'eau actifs (activeJets)", () => {
  it("vide avant toute casse, peuplé après, avec l'origine du jet", () => {
    const { handle } = build([
      sanitaireMesh("sanitaire_a", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0), { sorte: "cuvette" }),
    ]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);
    expect(sanitaires.activeJets).toHaveLength(0);

    sanitaires.destroyByName("sanitaire_a");
    expect(sanitaires.activeJets).toHaveLength(1);
    expect(sanitaires.activeJets[0]!.name).toBe("sanitaire_a");
    expect(sanitaires.activeJets[0]!.kind).toBe("cuvette");
    expect(sanitaires.activeJets[0]!.origin.y).toBeCloseTo(0, 5); // bas de la bbox, posée à y=0
  });
});

describe("SanitaireSystem — collectActiveJetOrigins (lecture sans allocation, core/waterAmbience.ts)", () => {
  it("vide `out` avant toute casse, peuplé après — mêmes origines qu'activeJets", () => {
    const { handle } = build([
      sanitaireMesh("sanitaire_a", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0), { sorte: "cuvette" }),
      sanitaireMesh("sanitaire_b", new THREE.Vector3(0.4, 0.5, 0.4), new THREE.Vector3(5, 0, 0), { sorte: "urinoir" }),
    ]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);

    const out: THREE.Vector3[] = [];
    sanitaires.collectActiveJetOrigins(out);
    expect(out).toHaveLength(0);

    sanitaires.destroyByName("sanitaire_a");
    sanitaires.collectActiveJetOrigins(out);
    expect(out).toHaveLength(1);
    expect(out[0]!.x).toBeCloseTo(0.3, 5); // bas-centre de la bbox (origine = coin, taille 0.6 en x)

    sanitaires.destroyByName("sanitaire_b");
    sanitaires.collectActiveJetOrigins(out);
    expect(out).toHaveLength(2);
  });

  it("réutilise le tableau `out` fourni plutôt que d'en allouer un neuf", () => {
    const { handle } = build([
      sanitaireMesh("sanitaire_a", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0), { sorte: "cuvette" }),
    ]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);
    sanitaires.destroyByName("sanitaire_a");

    const out: THREE.Vector3[] = [];
    sanitaires.collectActiveJetOrigins(out);
    const sameArray = out;
    sanitaires.collectActiveJetOrigins(out);
    expect(out).toBe(sameArray);
    expect(out).toHaveLength(1);
  });

  it("retombe à vide après une nouvelle casse annulée par une re-construction (niveau rechargé)", () => {
    const { handle } = build([
      sanitaireMesh("sanitaire_a", new THREE.Vector3(0.6, 0.8, 0.7), new THREE.Vector3(0, 0, 0), { sorte: "cuvette" }),
    ]);
    const sanitaires = new SanitaireSystem(handle.sanitaires);
    sanitaires.destroyByName("sanitaire_a");
    const out: THREE.Vector3[] = [];
    sanitaires.collectActiveJetOrigins(out);
    expect(out).toHaveLength(1);

    // Un rechargement de niveau construit une INSTANCE NEUVE (voir
    // `game/session/spawning.ts::loadGltfLevel`), jamais un `reset()` sur
    // celle-ci — aucun sanitaire n'y est encore cassé.
    const reloaded = new SanitaireSystem(handle.sanitaires);
    reloaded.collectActiveJetOrigins(out);
    expect(out).toHaveLength(0);
  });
});
