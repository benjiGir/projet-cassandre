/**
 * Jalon M2 (PLAN_EFFECT_XSTATE.md) : couvre les 7 cas de dégradation
 * documentés dans `src/game/level/loader.ts` (voir sa doc de tête, section
 * "Erreurs typées") + un chemin heureux complet.
 *
 * `buildLevelFromGltf` reste testé comme une frontière PLAIN-JS (comme
 * `runGameplaySync` dans `test/core/runtime.test.ts`) : vitest nu
 * (`describe`/`it`/`expect`/`vi`), pas `@effect/vitest` — c'est exactement la
 * fonction synchrone que `main.ts` appelle, aucune raison de la tester à
 * travers un générateur Effect qu'elle n'expose jamais publiquement.
 *
 * Fixtures : construites directement en THREE.js EN MÉMOIRE plutôt qu'en
 * réutilisant `tmp/fixture-gen.ts` (aller-retour GLTFExporter/GLTFLoader) —
 * départ documenté du conseil de réutilisation de l'énoncé : `tmp/` est
 * gitignored (un test committé ne peut pas en dépendre pour tourner en CI),
 * et `blenderName()` (voir `loader.ts`) retombe sur `obj.name` BRUT quand
 * `userData.name` est absent — exactement le cas d'un objet jamais passé par
 * `GLTFLoader`. Un objet construit à la main avec `.name = "col_box_test"`
 * est donc, du point de vue de ce fichier, indiscernable d'un objet importé
 * portant ce même nom. Ces fixtures sont aussi validées en aval par un
 * harnais Node headless jetable (`tmp/harness-m2-cases.ts`, non commité) qui
 * compare les logs `console.error` AVANT/APRÈS cette migration sur ces
 * mêmes 7 cas + le fixture `.glb` réel existant (`tmp/fixture.glb`,
 * `tmp/harness.ts`/`tmp/harness-forced-null-hull.ts`) : diff strictement
 * vide dans les deux sens (stdout ET stderr) — voir le rapport de tâche.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { initPhysics, PhysicsWorld } from "../../../src/physics/world";
import { buildLevelFromGltf } from "../../../src/game/level/loader";

await initPhysics();

function fakeGltf(objects: THREE.Object3D[], animations: THREE.AnimationClip[] = []): GLTF {
  const group = new THREE.Group();
  for (const obj of objects) group.add(obj);
  return { scene: group, animations } as unknown as GLTF;
}

function build(objects: THREE.Object3D[]) {
  const physics = new PhysicsWorld();
  const scene = new THREE.Scene();
  const handle = buildLevelFromGltf(fakeGltf(objects), scene, physics);
  return { handle, scene, physics };
}

function whiteMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0xffffff });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildLevelFromGltf (jalon M2) — chemin heureux", () => {
  it("construit un LevelHandle complet sans aucun console.error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const spawnPlayer = new THREE.Object3D();
    spawnPlayer.name = "spawn_player";
    spawnPlayer.position.set(1, 0, 2);

    const spawnSuit = new THREE.Object3D();
    spawnSuit.name = "spawn_suit_1";
    spawnSuit.position.set(5, 0, 5);

    const spawnDirector = new THREE.Object3D();
    spawnDirector.name = "spawn_director_1";
    spawnDirector.position.set(-5, 0, -5);

    const colBox = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), whiteMat());
    colBox.name = "col_box_wall";
    colBox.position.set(4, 0, 0);

    const colHull = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), whiteMat());
    colHull.name = "col_hull_rock";

    const colMeshRamp = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 3), whiteMat());
    colMeshRamp.name = "col_mesh_ramp";

    const colBareBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), whiteMat());
    colBareBox.name = "col_bare_box"; // col_* générique, box détectée -> cuboid

    const colBareRamp = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 3), whiteMat());
    colBareRamp.name = "col_bare_ramp"; // col_* générique, non-box -> trimesh

    const trig = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), whiteMat());
    trig.name = "trig_zone";

    const door = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.2), whiteMat());
    door.name = "door_exit";

    const use = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), whiteMat());
    use.name = "use_lever";
    use.userData.target = "door_exit";

    const secret = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), whiteMat());
    secret.name = "secret_1";

    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), whiteMat());
    prop.name = "plain_prop";

    const { handle, scene } = build([
      spawnPlayer,
      spawnSuit,
      spawnDirector,
      colBox,
      colHull,
      colMeshRamp,
      colBareBox,
      colBareRamp,
      trig,
      door,
      use,
      secret,
      prop,
    ]);

    expect(errorSpy).not.toHaveBeenCalled();

    expect(handle.spawnPlayer).not.toBeNull();
    expect(handle.spawnPlayer!.position.toArray()).toEqual([1, 0, 2]);

    expect(handle.stats).toEqual({
      colliderCount: 5,
      colliderKindCounts: { cuboid: 2, convexHull: 1, trimesh: 2 },
      spawnSuitCount: 1,
      spawnDirectorCount: 1,
      triggerCount: 1,
      doorCount: 1,
      useCount: 1,
      secretCount: 1,
      unprefixedMeshCount: 1,
      decorBatchCount: 1,
      lightCount: 0,
      propCount: 0,
      vitreCount: 0,
      vitreBatchCount: 0,
      doorBatchCount: 1, // un vantail seul de son matériau : son propre lot
      sanitaireCount: 0,
      sanitaireBatchCount: 0,
    });

    expect(handle.spawnSuits.map((s) => s.name)).toEqual(["spawn_suit_1"]);
    expect(handle.spawnDirectors.map((s) => s.name)).toEqual(["spawn_director_1"]);
    expect(handle.useObjects[0].targetName).toBe("door_exit");
    expect(handle.doors[0].halfExtents.y).toBeCloseTo(1, 5);

    // col_*/trig_*/secret_* : invisibles. door_*/use_*/non-préfixé : visibles.
    expect(colBox.visible).toBe(false);
    expect(colHull.visible).toBe(false);
    expect(colMeshRamp.visible).toBe(false);
    expect(colBareBox.visible).toBe(false);
    expect(colBareRamp.visible).toBe(false);
    expect(trig.visible).toBe(false);
    expect(secret.visible).toBe(false);
    expect(door.visible).toBe(true);
    expect(use.visible).toBe(true);
    expect(prop.visible).toBe(true);

    // Invariant #5 : reconverti en MeshLambertMaterial partout.
    expect(prop.material).toBeInstanceOf(THREE.MeshLambertMaterial);

    // dispose() retire root de la scène et reste sûr à appeler deux fois
    // (garanti par Scope.close, voir la doc de tête de loader.ts).
    handle.dispose();
    expect(scene.children.length).toBe(0);
    expect(() => handle.dispose()).not.toThrow();
  });
});

describe("buildLevelFromGltf (jalon M2) — les 7 cas de dégradation", () => {
  it("col_* (col_mesh_*) sans géométrie valide : MissingColliderGeometryError, pas de collider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const player = new THREE.Object3D();
    player.name = "spawn_player";

    const emptyGeo = new THREE.BufferGeometry();
    emptyGeo.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
    const mesh = new THREE.Mesh(emptyGeo, whiteMat());
    mesh.name = "col_mesh_empty";

    const { handle } = build([player, mesh]);

    expect(handle.stats.colliderCount).toBe(0);
    expect(errorSpy).toHaveBeenCalledWith('[level] "col_mesh_empty" (col_*) sans géométrie valide — aucun collider créé.');
  });

  it("col_* (col_mesh_*) avec 0 triangle : MissingColliderGeometryError, pas de collider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const player = new THREE.Object3D();
    player.name = "spawn_player";

    // 2 sommets, non indexé : index séquentiel de longueur 2 -> floor(2/3) = 0 triangle.
    const twoVerts = new THREE.BufferGeometry();
    twoVerts.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1], 3));
    const mesh = new THREE.Mesh(twoVerts, whiteMat());
    mesh.name = "col_mesh_zerotri";

    const { handle } = build([player, mesh]);

    expect(handle.stats.colliderCount).toBe(0);
    expect(errorSpy).toHaveBeenCalledWith('[level] "col_mesh_zerotri" (col_*) a 0 triangle — aucun collider créé.');
  });

  it("col_* dépassant MAX_COLLIDER_TRIANGLES : OversizedColliderWarning, collider quand même créé", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const player = new THREE.Object3D();
    player.name = "spawn_player";

    // Plan subdivisé 160x160 -> 2*160*160 = 51 200 triangles (> 50 000).
    // Non-box par construction (sommets intérieurs hors des coins de la
    // bounding box) : passe par le chemin col_* générique non-box.
    const big = new THREE.Mesh(new THREE.PlaneGeometry(10, 10, 160, 160), whiteMat());
    big.name = "col_bigmesh";

    const { handle } = build([player, big]);

    expect(handle.stats.colliderCount).toBe(1);
    expect(handle.stats.colliderKindCounts.trimesh).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      '[level] "col_bigmesh" (col_*) : 51200 triangles, au-delà du seuil de 50000 — signe probable d\'un mesh oublié en high-poly. Collider créé quand même.',
    );
  });

  it("spawn_player absent : MissingSpawnPlayerError, spawnPlayer reste null", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), whiteMat());
    mesh.name = "col_box_noop";

    const { handle } = build([mesh]);

    expect(handle.spawnPlayer).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      "[level] spawn_player absent du niveau — le joueur ne peut pas être positionné au chargement.",
    );
  });

  it("spawn_player en double : DuplicateSpawnPlayerError, seul le premier compte", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const a = new THREE.Object3D();
    a.name = "spawn_player";
    a.position.set(0, 0, 0);
    const b = new THREE.Object3D();
    b.name = "spawn_player";
    b.position.set(3, 0, 0);

    const { handle } = build([a, b]);

    expect(handle.spawnPlayer!.position.toArray()).toEqual([0, 0, 0]);
    expect(errorSpy).toHaveBeenCalledWith(
      "[level] spawn_player en double (2 occurrences) — seule la première rencontrée est utilisée.",
    );
  });

  it("trig_* non-box : NonBoxTriggerError, trigger ignoré", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const player = new THREE.Object3D();
    player.name = "spawn_player";
    const trig = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), whiteMat());
    trig.name = "trig_bad";

    const { handle } = build([player, trig]);

    expect(handle.triggers).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalledWith('[level] "trig_bad" (trig_*) n\'est pas une géométrie box — trigger ignoré.');
  });

  it("use_* sans cible : UntargetedUseObjectWarning, objet quand même retourné avec targetName: null", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const player = new THREE.Object3D();
    player.name = "spawn_player";
    const use = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), whiteMat());
    use.name = "use_untargeted";

    const { handle } = build([player, use]);

    expect(handle.useObjects).toHaveLength(1);
    expect(handle.useObjects[0].targetName).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      '[level] "use_untargeted" (use_*) n\'a pas de cible référencée dans ses extras ' +
        '(custom property Blender "target" attendue) — objet interactif sans effet exploitable.',
    );
  });

  it("col_hull_* dégénéré (convexHull -> null) : DegenerateConvexHullError, repli sur trimesh", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // RAPIER.ColliderDesc.convexHull ne renvoie `null` sur aucune entrée
    // testée empiriquement avec cette version de rapier3d-compat (voir
    // tmp/convexhull-experiment.mjs, cité par tmp/harness-forced-null-hull.ts)
    // — même monkey-patch que ce harnais pour exercer réellement le chemin de
    // repli documenté par le type de retour officiel (`ColliderDesc | null`).
    vi.spyOn(RAPIER.ColliderDesc, "convexHull").mockReturnValue(null);

    const player = new THREE.Object3D();
    player.name = "spawn_player";
    const hull = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), whiteMat());
    hull.name = "col_hull_forced_null";

    const { handle } = build([player, hull]);

    expect(handle.stats.colliderCount).toBe(1);
    expect(handle.stats.colliderKindCounts).toEqual({ cuboid: 0, convexHull: 0, trimesh: 1 });
    expect(errorSpy).toHaveBeenCalledWith(
      '[level] "col_hull_forced_null" (col_hull_*) : hull convexe dégénéré ' +
        "(RAPIER.ColliderDesc.convexHull a retourné null, sommets probablement coplanaires) " +
        "— repli sur un collider trimesh pour ce mesh.",
    );
  });
});
