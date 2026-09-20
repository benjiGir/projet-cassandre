/**
 * `door_*` animés (ADR 0031) — deux familles de tests, comme `props.test.ts` :
 * la géométrie/le minuteur PURS (aucun monde Rapier requis), et le VRAI
 * chemin de chargement (`buildLevelFromGltf`) pour tout ce qui touche un
 * collider/corps réel (activation/désactivation, refus de refermeture).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { initPhysics, PhysicsWorld } from "../../../src/physics/world";
import { buildLevelFromGltf } from "../../../src/game/level/loader";
import {
  DEFAULT_DOOR_MOVEMENT,
  DoorSystem,
  advanceDoorProgress,
  composeBattantPose,
  composeCoulissePose,
  composeVerticalPose,
  computeHingeGeometry,
  hingePivotInRootSpace,
  isActorBlockingClosedDoor,
  isActorInAutoRange,
  parseDoorConfig,
  parseDoorMovement,
  resolveAutoOpenSign,
  type DoorActor,
} from "../../../src/game/level/doors";

await initPhysics();

function whiteMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0xffffff });
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Géométrie et minuteur — fonctions pures
// ---------------------------------------------------------------------------

describe("parseDoorMovement / parseDoorConfig", () => {
  it("accepte les quatre mouvements connus", () => {
    expect(parseDoorMovement("battant")).toBe("battant");
    expect(parseDoorMovement("COULISSE")).toBe("coulisse"); // tolère la casse, comme parsePropMaterial
    expect(parseDoorMovement(" monte ")).toBe("monte");
    expect(parseDoorMovement("descend")).toBe("descend");
  });

  it("refuse le reste plutôt que de deviner", () => {
    expect(parseDoorMovement("glisse")).toBeNull();
    expect(parseDoorMovement(3)).toBeNull();
    expect(parseDoorMovement(undefined)).toBeNull();
  });

  it("défauts : angle 95°, charnière min, sens auto, durées par mouvement", () => {
    const cfg = parseDoorConfig("battant", {});
    expect(THREE.MathUtils.radToDeg(cfg.angleRad)).toBeCloseTo(95, 5);
    expect(cfg.charniere).toBe("min");
    expect(cfg.sens).toBe("auto");
    expect(cfg.duree).toBeCloseTo(0.5, 5);
    expect(cfg.auto).toBe(false);
    expect(cfg.referme).toBe(true);
    expect(cfg.delai).toBeCloseTo(1.2, 5);
    expect(cfg.groupe).toBeNull();
    expect(cfg.portee).toBeCloseTo(2.5, 5);

    expect(parseDoorConfig("coulisse", {}).duree).toBeCloseTo(0.45, 5);
    expect(parseDoorConfig("monte", {}).duree).toBeCloseTo(1.4, 5);
    expect(parseDoorConfig("descend", {}).duree).toBeCloseTo(0.6, 5);
  });

  it("lit toutes les extras quand elles sont présentes", () => {
    const cfg = parseDoorConfig("battant", {
      charniere: "max",
      angle: 120,
      sens: "-",
      course: 3,
      duree: 0.9,
      auto: true,
      referme: false,
      delai: 2,
      groupe: "reserve_vav",
      portee: 4,
    });
    expect(cfg.charniere).toBe("max");
    expect(THREE.MathUtils.radToDeg(cfg.angleRad)).toBeCloseTo(120, 5);
    expect(cfg.sens).toBe("-");
    expect(cfg.course).toBe(3);
    expect(cfg.duree).toBe(0.9);
    expect(cfg.auto).toBe(true);
    expect(cfg.referme).toBe(false);
    expect(cfg.delai).toBe(2);
    expect(cfg.groupe).toBe("reserve_vav");
    expect(cfg.portee).toBe(4);
  });
});

describe("computeHingeGeometry", () => {
  it("choisit le plus grand axe horizontal et place le pivot à l'extrémité demandée", () => {
    // Vantail 2m (X) x 2.5m (Y) x 0.2m (Z) : le grand axe horizontal est X.
    const min = new THREE.Vector3(-1, -1.25, -0.1);
    const max = new THREE.Vector3(1, 1.25, 0.1);

    const hingeMin = computeHingeGeometry(min, max, "min");
    expect(hingeMin.axis).toBe("x");
    expect(hingeMin.pivotLocal.x).toBeCloseTo(-1, 5);
    expect(hingeMin.farLocalDir.x).toBeCloseTo(1, 5);
    expect(hingeMin.grandAxisLocalLength).toBeCloseTo(2, 5);

    const hingeMax = computeHingeGeometry(min, max, "max");
    expect(hingeMax.pivotLocal.x).toBeCloseTo(1, 5);
    expect(hingeMax.farLocalDir.x).toBeCloseTo(-1, 5);
  });

  it("bascule sur Z quand c'est le grand axe", () => {
    const min = new THREE.Vector3(-0.1, -1, -1.5);
    const max = new THREE.Vector3(0.1, 1, 1.5);
    const hinge = computeHingeGeometry(min, max, "min");
    expect(hinge.axis).toBe("z");
    expect(hinge.pivotLocal.z).toBeCloseTo(-1.5, 5);
    expect(hinge.farLocalDir.z).toBeCloseTo(1, 5);
  });
});

describe("resolveAutoOpenSign — s'ouvrir en s'éloignant de l'ouvreur", () => {
  // Pivot à l'origine, bout libre vers +X (porte alignée sur X, charnière en −X).
  const pivot = new THREE.Vector3(0, 0, 0);
  const farDir = new THREE.Vector3(1, 0, 0);

  it("un ouvreur du côté +Z du plan de la porte ouvre dans un sens", () => {
    const opener = new THREE.Vector3(0.5, 0, 3);
    const sign = resolveAutoOpenSign(pivot, farDir, opener);
    expect(sign === 1 || sign === -1).toBe(true);
  });

  it("un ouvreur du côté OPPOSÉ ouvre dans le sens OPPOSÉ", () => {
    const cote1 = resolveAutoOpenSign(pivot, farDir, new THREE.Vector3(0.5, 0, 3));
    const cote2 = resolveAutoOpenSign(pivot, farDir, new THREE.Vector3(0.5, 0, -3));
    expect(cote2).toBe(-cote1);
  });

  it("le bout libre s'écarte réellement du côté de l'ouvreur (pas vers lui)", () => {
    // Ouvreur du côté +Z : après une petite rotation dans le sens résolu, le
    // bout libre doit avoir bougé vers -Z (s'écarter), jamais vers +Z.
    const opener = new THREE.Vector3(0.5, 0, 3);
    const sign = resolveAutoOpenSign(pivot, farDir, opener);
    const closedPosition = new THREE.Vector3(1, 0, 0); // bout libre, porte fermée
    const rotated = closedPosition.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), sign * 0.2);
    expect(rotated.z).toBeLessThan(0); // s'éloigne de l'ouvreur (+Z), jamais vers lui
  });
});

describe("hingePivotInRootSpace / composeBattantPose", () => {
  it("pivot à l'origine, porte tournée de 90° : le bout libre suit la même rotation qu'applyAxisAngle (méthode INDÉPENDANTE de THREE)", () => {
    const closedPosition = new THREE.Vector3(2, 0, 0);
    const closedQuaternion = new THREE.Quaternion(); // identité
    const pivotWorld = new THREE.Vector3(0, 0, 0);

    const outPos = new THREE.Vector3();
    const outQuat = new THREE.Quaternion();
    composeBattantPose(closedPosition, closedQuaternion, pivotWorld, Math.PI / 2, outPos, outQuat);

    const expected = closedPosition.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    expect(outPos.x).toBeCloseTo(expected.x, 5);
    expect(outPos.y).toBeCloseTo(expected.y, 5);
    expect(outPos.z).toBeCloseTo(expected.z, 5);
  });

  it("theta = 0 : la pose reste EXACTEMENT la pose fermée", () => {
    const closedPosition = new THREE.Vector3(3, 1, -2);
    const closedQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4);
    const pivotWorld = new THREE.Vector3(1, 1, -2);

    const outPos = new THREE.Vector3();
    const outQuat = new THREE.Quaternion();
    composeBattantPose(closedPosition, closedQuaternion, pivotWorld, 0, outPos, outQuat);

    expect(outPos.distanceTo(closedPosition)).toBeLessThan(1e-9);
    expect(outQuat.angleTo(closedQuaternion)).toBeLessThan(1e-9);
  });

  it("hingePivotInRootSpace applique bien l'échelle avant la rotation (TRS)", () => {
    const closedPosition = new THREE.Vector3(10, 0, 0);
    const closedQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const pivotLocal = new THREE.Vector3(2, 0, 0); // 2m à l'échelle 1
    const scale = new THREE.Vector3(3, 1, 1); // échelle x3 sur l'axe du pivot

    const out = new THREE.Vector3();
    hingePivotInRootSpace(closedPosition, closedQuaternion, pivotLocal, scale, out);

    // pivotLocal * scale = (6,0,0), tourné de 90° autour de Y -> (0,0,-6), + closedPosition (10,0,0)
    expect(out.x).toBeCloseTo(10, 5);
    expect(out.y).toBeCloseTo(0, 5);
    expect(out.z).toBeCloseTo(-6, 5);
  });
});

describe("composeCoulissePose / composeVerticalPose", () => {
  it("glisse le long du grand axe LOCAL, transformé par la rotation fermée", () => {
    const closedPosition = new THREE.Vector3(0, 0, 0);
    const closedQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const out = new THREE.Vector3();
    composeCoulissePose(closedPosition, closedQuaternion, "x", 1, 2, out);
    // Axe local X tourné de 90° autour de Y -> -Z (voir composeBattantPose ci-dessus, même rotation).
    expect(out.x).toBeCloseTo(0, 5);
    expect(out.z).toBeCloseTo(-2, 5);
  });

  it("monte va vers +Y, descend vers -Y, même magnitude", () => {
    const closedPosition = new THREE.Vector3(0, 1, 0);
    const up = new THREE.Vector3();
    const down = new THREE.Vector3();
    composeVerticalPose(closedPosition, 1, 2.45, up);
    composeVerticalPose(closedPosition, -1, 2.45, down);
    expect(up.y).toBeCloseTo(3.45, 5);
    expect(down.y).toBeCloseTo(-1.45, 5);
  });
});

describe("isActorBlockingClosedDoor / isActorInAutoRange", () => {
  const closedPosition = new THREE.Vector3(0, 1, 0);
  const closedQuaternion = new THREE.Quaternion();
  const halfExtents = new THREE.Vector3(1, 1.25, 0.1);

  it("un acteur dans la boîte inflée bloque, hors de la boîte ne bloque pas", () => {
    const dedans: DoorActor = { position: new THREE.Vector3(0.5, 1, 0), radius: 0.3, halfHeight: 0.9 };
    const dehors: DoorActor = { position: new THREE.Vector3(5, 1, 0), radius: 0.3, halfHeight: 0.9 };
    expect(isActorBlockingClosedDoor(closedPosition, closedQuaternion, halfExtents, dedans)).toBe(true);
    expect(isActorBlockingClosedDoor(closedPosition, closedQuaternion, halfExtents, dehors)).toBe(false);
  });

  it("respecte la rotation du vantail (test en espace LOCAL)", () => {
    // Vantail tourné de 90° : sa "largeur" (halfExtents.x=1) pointe maintenant sur Z.
    const rotated = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const surXMonde: DoorActor = { position: new THREE.Vector3(0.5, 1, 0), radius: 0.05, halfHeight: 0.9 };
    const surZMonde: DoorActor = { position: new THREE.Vector3(0, 1, 0.5), radius: 0.05, halfHeight: 0.9 };
    expect(isActorBlockingClosedDoor(closedPosition, rotated, halfExtents, surXMonde)).toBe(false);
    expect(isActorBlockingClosedDoor(closedPosition, rotated, halfExtents, surZMonde)).toBe(true);
  });

  it("portée horizontale + tolérance d'altitude fixe (2 m)", () => {
    const center = new THREE.Vector3(0, 0, 0);
    const proche: DoorActor = { position: new THREE.Vector3(2, 0, 0), radius: 0.3, halfHeight: 0.9 };
    const loin: DoorActor = { position: new THREE.Vector3(10, 0, 0), radius: 0.3, halfHeight: 0.9 };
    const enHauteur: DoorActor = { position: new THREE.Vector3(1, 5, 0), radius: 0.3, halfHeight: 0.9 };
    expect(isActorInAutoRange(center, proche, 2.5)).toBe(true);
    expect(isActorInAutoRange(center, loin, 2.5)).toBe(false);
    expect(isActorInAutoRange(center, enHauteur, 2.5)).toBe(false);
  });
});

describe("advanceDoorProgress", () => {
  it("avance vers 1, recule vers 0, clampé aux deux bouts", () => {
    expect(advanceDoorProgress(0, 1, 1 / 60, 0.5)).toBeCloseTo((1 / 60) / 0.5, 5);
    expect(advanceDoorProgress(0.99, 1, 1, 0.5)).toBe(1); // dépasserait 1 sans le clamp
    expect(advanceDoorProgress(0.01, 0, 1, 0.5)).toBe(0); // dépasserait 0 sans le clamp
  });
});

// ---------------------------------------------------------------------------
// DoorSystem — vrai chemin de chargement (`buildLevelFromGltf`)
// ---------------------------------------------------------------------------

function doorMesh(name: string, size: THREE.Vector3, at: THREE.Vector3, extras: Record<string, unknown> = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), whiteMat());
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

const NO_ACTORS: DoorActor[] = [];
const DT = 1 / 60;

/** Les messages `door_*` seulement — un fixture sans `spawn_player` en produit un autre, sans rapport. */
function doorWarnings(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls.map((call: unknown[]) => String(call[0])).filter((msg: string) => msg.includes("(door_*)"));
}

describe("DoorSystem — chargement", () => {
  it("mouvement absent -> DEFAULT_DOOR_MOVEMENT, sans avertissement", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handle } = build([doorMesh("door_plain", new THREE.Vector3(2, 2.5, 0.2), new THREE.Vector3(0, 1.25, 0))]);
    expect(handle.doors[0]!.movement).toBe(DEFAULT_DOOR_MOVEMENT);
    expect(doorWarnings(errorSpy)).toHaveLength(0);
  });

  it("mouvement inconnu -> avertissement bruyant, repli sur le défaut", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handle } = build([
      doorMesh("door_bizarre", new THREE.Vector3(2, 2.5, 0.2), new THREE.Vector3(0, 1.25, 0), { mouvement: "teleporte" }),
    ]);
    expect(handle.doors[0]!.movement).toBe(DEFAULT_DOOR_MOVEMENT);
    const messages = errorSpy.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes("door_*") && m.includes("teleporte"))).toBe(true);
  });

  it("corps FIXE à la pose fermée, collider actif par défaut", () => {
    const { handle } = build([doorMesh("door_x", new THREE.Vector3(2, 2.5, 0.2), new THREE.Vector3(0, 1.25, 0))]);
    const door = handle.doors[0]!;
    expect(door.body.isFixed()).toBe(true);
    expect(door.collider.isEnabled()).toBe(true);
  });
});

describe("DoorSystem — descend (défaut), collider actif seulement fermé", () => {
  it("s'enfonce de sa propre hauteur, collider désactivé dès l'ouverture, réactivé une fois fermé", () => {
    const { handle } = build([doorMesh("door_x", new THREE.Vector3(2, 2.5, 0.2), new THREE.Vector3(0, 1.25, 0))]);
    const doors = new DoorSystem(handle.doors);
    const collider = handle.doors[0]!.collider;

    expect(doors.open("door_x", new THREE.Vector3())).toBe(true);
    expect(collider.isEnabled()).toBe(false);
    expect(doors.stateOf("door_x")).toBe("opening");

    // Assez de pas fixes pour ouvrir complètement (0.6 s par défaut, voir MOVEMENT_DEFAULT_DUREE).
    for (let i = 0; i < 60; i++) doors.update(DT, NO_ACTORS);
    expect(doors.stateOf("door_x")).toBe("open");
    doors.interpolate(1);
    expect(handle.doors[0]!.object.position.y).toBeCloseTo(1.25 - 2.5, 3); // descend de sa hauteur

    // `open` sur une porte à carte/`use_*` est PERMANENT : jamais de fermeture automatique.
    for (let i = 0; i < 600; i++) doors.update(DT, NO_ACTORS);
    expect(doors.stateOf("door_x")).toBe("open");
    expect(collider.isEnabled()).toBe(false);
  });

  it("nom inconnu : retourne false, sans effet", () => {
    const { handle } = build([doorMesh("door_x", new THREE.Vector3(2, 2.5, 0.2), new THREE.Vector3(0, 1.25, 0))]);
    const doors = new DoorSystem(handle.doors);
    expect(doors.open("door_inconnue", new THREE.Vector3())).toBe(false);
    expect(doors.stateOf("door_inconnue")).toBeNull();
  });
});

describe("DoorSystem — battant, sens auto", () => {
  it("le vantail pivote autour de sa charnière, en s'éloignant de l'ouvreur", () => {
    const { handle } = build([
      doorMesh("door_battant", new THREE.Vector3(2, 2.5, 0.2), new THREE.Vector3(0, 1.25, 0), {
        mouvement: "battant",
        charniere: "min", // pivot au bord -X du vantail (localMin.x)
        angle: 90,
        duree: 1, // un pas de 1s = 100% pour un calcul simple
      }),
    ]);
    const doors = new DoorSystem(handle.doors);

    // Ouvreur du côté +Z : le bout libre (au départ vers +X) doit s'écarter vers -Z.
    doors.open("door_battant", new THREE.Vector3(0, 1.25, 3));
    doors.update(1, NO_ACTORS); // 1s = durée complète -> progress = 1, angle = 90°
    doors.interpolate(1);

    const pose = handle.doors[0]!.object;
    // Bord +X du vantail (là où était le bout libre) : après rotation de 90°
    // autour de la charnière (-1,1.25,0), doit être passé du côté -Z.
    expect(pose.position.z).toBeLessThan(0);
  });
});

describe("DoorSystem — coulisse, longueur par défaut", () => {
  it("glisse de la longueur du vantail quand `course` est absent", () => {
    const { handle } = build([
      doorMesh("door_coulisse", new THREE.Vector3(1.8, 2.2, 0.08), new THREE.Vector3(5, 1.1, 2), {
        mouvement: "coulisse",
        duree: 1,
      }),
    ]);
    const doors = new DoorSystem(handle.doors);
    doors.open("door_coulisse", new THREE.Vector3());
    doors.update(1, NO_ACTORS);
    doors.interpolate(1);

    const pose = handle.doors[0]!.object;
    const deplacement = pose.position.distanceTo(new THREE.Vector3(5, 1.1, 2));
    expect(deplacement).toBeCloseTo(1.8, 3); // longueur du grand axe (X, 1.8 m)
  });
});

describe("DoorSystem — monte, course explicite", () => {
  it("monte de la valeur de `course` demandée", () => {
    const { handle } = build([
      doorMesh("door_argent", new THREE.Vector3(2.5, 2.5, 0.1), new THREE.Vector3(0, 1.25, 0), {
        mouvement: "monte",
        course: 2.45,
        duree: 1,
      }),
    ]);
    const doors = new DoorSystem(handle.doors);
    doors.open("door_argent", new THREE.Vector3());
    doors.update(1, NO_ACTORS);
    doors.interpolate(1);
    expect(handle.doors[0]!.object.position.y).toBeCloseTo(1.25 + 2.45, 3);
  });
});

describe("DoorSystem — groupes (portes doubles)", () => {
  it("ouvrir l'un des deux vantaux ouvre tout le groupe", () => {
    const { handle } = build([
      doorMesh("door_exit", new THREE.Vector3(1, 2.5, 0.1), new THREE.Vector3(-0.5, 1.25, 0), {
        groupe: "sortie",
      }),
      doorMesh("door_exit_b", new THREE.Vector3(1, 2.5, 0.1), new THREE.Vector3(0.5, 1.25, 0), {
        groupe: "sortie",
      }),
    ]);
    const doors = new DoorSystem(handle.doors);

    expect(doors.open("door_exit", new THREE.Vector3())).toBe(true);
    expect(doors.stateOf("door_exit")).toBe("opening");
    expect(doors.stateOf("door_exit_b")).toBe("opening"); // le second vantail suit, sans appel séparé
  });
});

describe("batchDoorMeshes — un lot de dessin par matériau", () => {
  function paire() {
    return build([
      doorMesh("door_exit", new THREE.Vector3(1, 2.5, 0.1), new THREE.Vector3(-0.5, 1.25, 0), {
        mouvement: "battant",
        groupe: "sortie",
      }),
      doorMesh("door_exit_b", new THREE.Vector3(1, 2.5, 0.1), new THREE.Vector3(0.5, 1.25, 0), {
        mouvement: "battant",
        charniere: "max",
        groupe: "sortie",
      }),
    ]);
  }

  it("deux vantaux du même matériau partagent UN lot, leurs meshes sont cachés", () => {
    const { handle } = paire();
    expect(handle.stats.doorBatchCount).toBe(1);
    const [a, b] = handle.doors;
    expect(a!.batchSlot).toBeDefined();
    expect(b!.batchSlot!.batch).toBe(a!.batchSlot!.batch);
    expect(a!.object.visible).toBe(false);
    expect(b!.object.visible).toBe(false);
  });

  it("la pose animée est recopiée dans le lot, pas seulement dans le mesh caché", () => {
    const { handle } = paire();
    const doors = new DoorSystem(handle.doors);
    doors.open("door_exit", new THREE.Vector3(0, 1, 2));
    for (let i = 0; i < 60; i++) {
      doors.snapshotPrevious();
      doors.update(DT, NO_ACTORS);
    }
    doors.interpolate(1);

    const door = handle.doors[0]!;
    const slot = door.batchSlot!;
    const dansLeLot = new THREE.Matrix4();
    slot.batch.getMatrixAt(slot.instanceId, dansLeLot);
    door.object.updateMatrix();
    // Un lot stocke ses matrices en simple précision : on compare à 1e-5 près.
    for (let i = 0; i < 16; i++) {
      expect(dansLeLot.elements[i]!).toBeCloseTo(door.object.matrix.elements[i]!, 5);
    }
    const fermee = new THREE.Matrix4().compose(door.closedPosition, door.closedQuaternion, door.scale);
    expect(dansLeLot.equals(fermee)).toBe(false); // elle a vraiment bougé
  });

  it("un vantail seul de son matériau reste un mesh ordinaire, visible", () => {
    const { handle } = build([doorMesh("door_seule", new THREE.Vector3(2, 2.5, 0.2), new THREE.Vector3(0, 1.25, 0))]);
    expect(handle.stats.doorBatchCount).toBe(1);
    expect(handle.doors[0]!.batchSlot).toBeUndefined();
    expect(handle.doors[0]!.object.visible).toBe(true);
  });
});

describe("DoorSystem — portes auto", () => {
  function autoDoor(extra: Record<string, unknown> = {}) {
    return doorMesh("door_auto", new THREE.Vector3(2, 2.5, 0.2), new THREE.Vector3(0, 1.25, 0), {
      mouvement: "coulisse",
      auto: true,
      duree: 0.2,
      delai: 0.5,
      portee: 2.5,
      ...extra,
    });
  }
  const PRES: DoorActor = { position: new THREE.Vector3(1, 1, 0), radius: 0.3, halfHeight: 0.9 };

  it("s'ouvre quand un acteur entre à portée, se referme après le délai une fois seul", () => {
    const { handle } = build([autoDoor()]);
    const doors = new DoorSystem(handle.doors);

    doors.update(DT, [PRES]);
    expect(doors.stateOf("door_auto")).toBe("opening");
    for (let i = 0; i < 30; i++) doors.update(DT, [PRES]);
    expect(doors.stateOf("door_auto")).toBe("open");

    // Plus personne : referme après `delai` (0.5s) + `duree` (0.2s).
    for (let i = 0; i < 60; i++) doors.update(DT, NO_ACTORS);
    expect(doors.stateOf("door_auto")).toBe("closed");
    expect(handle.doors[0]!.collider.isEnabled()).toBe(true);
  });

  it("`referme: false` : reste ouverte pour toujours une fois ouverte", () => {
    const { handle } = build([autoDoor({ referme: false })]);
    const doors = new DoorSystem(handle.doors);

    doors.update(DT, [PRES]);
    for (let i = 0; i < 30; i++) doors.update(DT, [PRES]);
    expect(doors.stateOf("door_auto")).toBe("open");

    for (let i = 0; i < 6000; i++) doors.update(DT, NO_ACTORS);
    expect(doors.stateOf("door_auto")).toBe("open");
  });

  it("rouvre plutôt que de refermer sur un acteur qui chevauche encore le vantail", () => {
    const { handle } = build([autoDoor()]);
    const doors = new DoorSystem(handle.doors);
    const collider = handle.doors[0]!.collider;

    doors.update(DT, [PRES]);
    for (let i = 0; i < 30; i++) doors.update(DT, [PRES]);
    expect(doors.stateOf("door_auto")).toBe("open");

    // `PRES` s'éloigne hors de portée `auto` (déclenche la fermeture), mais
    // un AUTRE acteur reste physiquement DANS le vantail (chevauchement).
    const bloqueur: DoorActor = { position: new THREE.Vector3(0, 1.25, 0), radius: 0.5, halfHeight: 0.9 };
    for (let i = 0; i < 60; i++) doors.update(DT, [bloqueur]);
    // Le délai (0.5s) + la durée de fermeture (0.2s) sont largement écoulés :
    // sans le refus de refermeture, la porte serait "closed" ici.
    expect(doors.stateOf("door_auto")).not.toBe("closed");
    expect(collider.isEnabled()).toBe(false); // jamais réactivé sur un chevauchement
  });

  it("colliders `auto` exposés pour rendre le bake de navigation passant", () => {
    const { handle } = build([
      autoDoor(),
      doorMesh("door_carte", new THREE.Vector3(2, 2.5, 0.2), new THREE.Vector3(5, 1.25, 0)), // non-auto
    ]);
    const doors = new DoorSystem(handle.doors);
    const autoColliders = doors.autoGroupColliders;
    expect(autoColliders).toHaveLength(1);
    expect(autoColliders[0]).toBe(handle.doors.find((d) => d.name === "door_auto")!.collider);
  });
});

describe("DoorSystem — hot reload", () => {
  it("réouvre silencieusement une porte déjà déverrouillée, sans son ni double appel", () => {
    const { handle } = build([doorMesh("door_or", new THREE.Vector3(2, 2.5, 0.2), new THREE.Vector3(0, 1.25, 0))]);
    const doors = new DoorSystem(handle.doors);

    doors.open("door_or", new THREE.Vector3(), { silent: true });
    expect(doors.movementEvents).toHaveLength(0);
    expect(doors.stateOf("door_or")).toBe("opening");
    expect(handle.doors[0]!.collider.isEnabled()).toBe(false);
  });
});
