/**
 * Jalon N5 (`PLAN_NIVEAU_V2.md`) — repro headless de l'occlusion des lignes
 * de vue ennemies, écrit pour trancher la cause racine restée ouverte dans
 * [ADR 0022](../../../docs/decisions/0022-occlusion-rangees-non-bloquante.md) :
 * une rangée de gondoles ou de racks bloque-t-elle VRAIMENT le regard d'un
 * Costard, ou le contournement par la distance (Zones C et D) était-il
 * inévitable ?
 *
 * Deux familles de fixtures, volontairement complémentaires :
 *
 * 1. **Synthétiques** — des meshes `col_box_*` construits en mémoire et
 *    passés au VRAI `buildLevelFromGltf`, donc au vrai chemin cuboid du
 *    loader (même technique que `test/game/level/loader.test.ts`). Elles
 *    isolent une pièce à la fois, aux cotes réelles du kit
 *    (`tools/blender/kit_spec.py`).
 * 2. **Le vrai niveau exporté** — `public/assets/levels/*.glb` relu par
 *    `GLTFLoader.parse` (pur ArrayBuffer, aucun DOM requis tant que le
 *    fichier n'a pas de texture), aux positions de spawn HISTORIQUES,
 *    celles-là mêmes que l'ADR 0022 a déplacées. C'est la fixture qui a
 *    valeur de preuve : mêmes octets que le jeu.
 *
 * Contrairement à `suit.test.ts`, ce fichier NE SCRIPTE PAS
 * `RaycastService` : c'est le vrai service, contre un vrai monde Rapier, qui
 * doit répondre. Les deux fichiers cohabitent parce que vitest isole les
 * modules par FICHIER de test (le singleton de service n'est pas partagé
 * entre eux).
 *
 * Le comportement observé est lu sur `Suit.state` plutôt que sur un
 * `hasClearWorldPath` exporté pour l'occasion : `idle -> alert` au premier
 * pas fixe EST le test de ligne de vue (`enemyMachine.ts::runIdle`), et
 * garder la fonction privée évite d'élargir l'API du module pour un test.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";

import { GROUP, initPhysics, interactionGroups, PhysicsWorld } from "../../../src/physics/world";
import { buildLevelFromGltf } from "../../../src/game/level/loader";
import { Suit, configureSuitCharacterController, type SuitUpdateContext } from "../../../src/game/entities/suit";
import { suitConfig } from "../../../src/game/entities/suitConfig";

await initPhysics();

/** Pas fixe de référence (invariant #1). */
const DT = 1 / 60;

/** Joueur au repos à l'origine — c'est le `spawn_player` de toutes les zones. */
const PLAYER_FEET = new THREE.Vector3(0, 0, 0);
const PLAYER_EYE = new THREE.Vector3(0, suitConfig.eyeHeight, 0);

// Positions de spawn D'ORIGINE, avant le contournement par la distance de
// l'ADR 0022 (voir level_spec.py). Conversion Blender Z-up -> three Y-up :
// three.x = blender.x, three.y = blender.z, three.z = -blender.y.
const ZONE_D_SUIT_1 = new THREE.Vector3(-10, 0, -10);
const ZONE_D_SUIT_2 = new THREE.Vector3(10, 0, -10);
const ZONE_C_SUIT_1 = new THREE.Vector3(-2.125, 0, -12);

// ---------------------------------------------------------------------------
// Fixtures synthétiques : un `col_box_*` posé à la main, vrai chemin loader
// ---------------------------------------------------------------------------

/**
 * Un mesh `col_box_*` aux cotes MONDE demandées (three.js : y = hauteur),
 * centré sur `center`. Le loader recentre lui-même sur la bounding box
 * locale (`buildCuboidCollider`), donc l'origine coin du kit n'a pas besoin
 * d'être reproduite ici.
 */
function colBox(name: string, center: THREE.Vector3, size: THREE.Vector3): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
  );
  mesh.name = name;
  mesh.position.copy(center);
  return mesh;
}

function fakeGltf(objects: THREE.Object3D[]): GLTF {
  const group = new THREE.Group();
  for (const obj of objects) group.add(obj);
  return { scene: group, animations: [] } as unknown as GLTF;
}

interface RigOptions {
  /** `false` reproduit la condition d'avant le correctif du 2026-09-11 : des
   * colliders créés mais jamais rendus visibles aux requêtes de scène. */
  stepped?: boolean;
  /** Pieds du joueur. Par défaut l'origine, qui est le `spawn_player` de
   * toutes les zones du niveau actuel. */
  playerFeet?: THREE.Vector3;
}

/** Monde + Costard prêts à recevoir `update()`. */
function rig(objects: THREE.Object3D[] | GLTF, enemyFeet: THREE.Vector3, options: RigOptions = {}) {
  const { stepped = true, playerFeet = PLAYER_FEET } = options;
  const physics = new PhysicsWorld();
  const scene = new THREE.Scene();
  const gltf = Array.isArray(objects) ? fakeGltf(objects) : objects;
  const handle = buildLevelFromGltf(gltf, scene, physics);

  if (stepped) physics.refreshSceneQueries();

  const suit = new Suit(physics, enemyFeet, new THREE.Vector3(0, 0, 1), 1, suitConfig);
  const kcc = physics.world.createCharacterController(suitConfig.colliderOffset);
  configureSuitCharacterController(kcc, suitConfig);

  const ctx: SuitUpdateContext = {
    physics,
    kcc,
    playerTargetPosition: playerFeet.clone(),
    playerEyePosition: new THREE.Vector3(playerFeet.x, playerFeet.y + suitConfig.eyeHeight, playerFeet.z),
    navGraph: null,
  };

  return { suit, ctx, physics, handle };
}

/** Un seul pas fixe : suffit pour lire la décision de `runIdle` (ligne de vue). */
function stateAfterOneStep(...args: Parameters<typeof rig>): string {
  const { suit, ctx } = rig(...args);
  suit.update(DT, ctx);
  return suit.state;
}

/**
 * Point où le rayon de ligne de vue s'arrête, ou `null` s'il passe. Rejoue
 * exactement la requête de `enemyMachine.ts::hasClearWorldPath` (mêmes
 * groupes, même marge de 5 cm, même exclusion des sensors) : sert à vérifier
 * QUI occulte, pas seulement QUE ça occulte — une fixture qui passerait grâce
 * à un pilier oublié serait un piège pour la suite.
 */
function occluderPoint(physics: PhysicsWorld, from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 | null {
  const dir = to.clone().sub(from).normalize();
  const ray = new RAPIER.Ray(from, dir);
  const hit = physics.world.castRay(
    ray,
    from.distanceTo(to) - 0.05,
    true,
    RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
    interactionGroups(GROUP.ENEMY, GROUP.WORLD),
  );
  if (hit === null) return null;
  const p = ray.pointAt(hit.timeOfImpact);
  return new THREE.Vector3(p.x, p.y, p.z);
}

/** Yeux d'un Costard debout à cette position de pieds. */
function eyesAt(feet: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(feet.x, feet.y + suitConfig.eyeHeight, feet.z);
}

/** Sol commun aux fixtures synthétiques — le Costard doit avoir de quoi se tenir. */
function floor(): THREE.Mesh {
  return colBox("col_box_floor", new THREE.Vector3(0, -0.5, -8), new THREE.Vector3(40, 1, 40));
}

describe("Occlusion de la ligne de vue ennemie (N5) — pièces du kit isolées", () => {
  it("témoin : rien entre les deux, le Costard voit le joueur", () => {
    expect(stateAfterOneStep([floor()], new THREE.Vector3(0, 0, -8))).toBe("alert");
  });

  it("gondole (sommet 2.0 m > yeux 1.6 m) : la ligne de vue est bloquée", () => {
    // kit_gondola_4m : 4 m de long, 1.25 m de profondeur, 2.0 m de haut.
    const gondola = colBox("col_box_gondola_4m", new THREE.Vector3(0, 1, -4), new THREE.Vector3(4, 2, 1.25));
    expect(stateAfterOneStep([floor(), gondola], new THREE.Vector3(0, 0, -8))).toBe("idle");
  });

  it("mur de coque : même résultat qu'une gondole — rien ne distingue une pièce PROP d'un mur", () => {
    const wall = colBox("col_box_wall_4m", new THREE.Vector3(0, 2.5, -4), new THREE.Vector3(4, 5, 0.25));
    expect(stateAfterOneStep([floor(), wall], new THREE.Vector3(0, 0, -8))).toBe("idle");
  });

  it("caisse de sortie (1.10 m < yeux 1.6 m) : ne bloque rien, couverture visuelle seulement", () => {
    // Écart connu depuis la Zone B (voir CLAUDE.md) : kit_checkout passe sous
    // la hauteur des yeux, partagée par le joueur et le Costard.
    const checkout = colBox("col_box_checkout", new THREE.Vector3(0, 0.55, -4), new THREE.Vector3(3, 1.1, 1));
    expect(stateAfterOneStep([floor(), checkout], new THREE.Vector3(0, 0, -8))).toBe("alert");
  });

  it("CAUSE RACINE de l'ADR 0022 : sans pas de physique, le rayon traverse la gondole", () => {
    // Rapier ne peuple sa broad-phase qu'au premier `step()` : avant le
    // correctif du 2026-09-11 (`PhysicsWorld.refreshSceneQueries()` au
    // chargement), le premier rayon de ligne de vue partait dans un monde
    // encore vide de colliders. L'ennemi se réveillait donc à travers la
    // géométrie, puis `alert -> chase` est inconditionnel.
    const gondola = colBox("col_box_gondola_4m", new THREE.Vector3(0, 1, -4), new THREE.Vector3(4, 2, 1.25));
    expect(stateAfterOneStep([floor(), gondola], new THREE.Vector3(0, 0, -8), { stepped: false })).toBe("alert");
  });
});

// ---------------------------------------------------------------------------
// Fixtures sur le vrai niveau exporté
// ---------------------------------------------------------------------------

function parseLevel(file: string): Promise<GLTF> {
  const buf = readFileSync(resolve("public/assets/levels", file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  // `parse` est asynchrone même sans I/O : le callback part sur une
  // microtâche. Aucun DOM requis, ces niveaux n'ont pas de texture.
  return new Promise((res, rej) => new GLTFLoader().parse(ab, "", res, rej));
}

describe("Occlusion de la ligne de vue ennemie (N5) — vrai niveau exporté", () => {
  it("Zone D, position HISTORIQUE de spawn_suit_1 : occultée, par un pilier de la travée", async () => {
    // Blender (-10, 10, 0) -> three (-10, 0, -10), à 14.1 m du spawn joueur,
    // donc sous sightRange (22) ET sous attackRange (16). C'est la position
    // que l'ADR 0022 a déplacée à Y=16 faute d'occlusion constatée en jeu.
    // Elle est en fait occultée — mais par `col_box_pillar` (Blender (-9, 8),
    // arête à (-8.5, -8.5) en three), qui s'intercale AVANT la rangée ouest.
    // Nommer le vrai occulteur importe : l'analyse géométrique d'origine
    // (tools/blender/README.md) ne regardait que les racks.
    const gltf = await parseLevel("zone_d_reserve.glb");
    const { suit, ctx, physics } = rig(gltf, ZONE_D_SUIT_1);

    const hit = occluderPoint(physics, eyesAt(ZONE_D_SUIT_1), PLAYER_EYE);
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(-8.5, 2);
    expect(hit!.z).toBeCloseTo(-8.5, 2);

    suit.update(DT, ctx);
    expect(suit.state).toBe("idle");
  });

  it("Zone D, même position sans pas de physique : le Costard voit à travers tout", async () => {
    const gltf = await parseLevel("zone_d_reserve.glb");
    const { suit, ctx, physics } = rig(gltf, ZONE_D_SUIT_1, { stepped: false });

    expect(occluderPoint(physics, eyesAt(ZONE_D_SUIT_1), PLAYER_EYE)).toBeNull();

    suit.update(DT, ctx);
    expect(suit.state).toBe("alert");
  });

  it("Zone D, position HISTORIQUE de spawn_suit_2 : occultée par un EFFLEUREMENT de coin", async () => {
    // Répond à la question laissée ouverte dans tools/blender/README.md :
    // le segment spawn -> suit_2 ne croise l'empreinte réelle de la rangée est
    // (three : X∈[2.8,4.0], Z∈[-8,-4]) qu'à son coin exact (4, -4). Le rayon
    // s'y arrête bel et bien — mais un pas de côté du joueur suffit à ouvrir
    // la vue. Occlusion réelle, robustesse nulle : à ne pas reproduire.
    const gltf = await parseLevel("zone_d_reserve.glb");
    const { suit, ctx, physics } = rig(gltf, ZONE_D_SUIT_2);

    const hit = occluderPoint(physics, eyesAt(ZONE_D_SUIT_2), PLAYER_EYE);
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(4, 2);
    expect(hit!.z).toBeCloseTo(-4, 2);

    suit.update(DT, ctx);
    expect(suit.state).toBe("idle");
  });

  it("Zone C, position HISTORIQUE de spawn_suit_1 : occultée depuis le spawn par un capuchon de bout", async () => {
    // Blender (-2.125, 12, 0) -> three (-2.125, 0, -12) : le centre d'une
    // allée centrale, la position du premier jet, tenue pour « en `attack`
    // dès le spawn ». Depuis le `spawn_player` EXACT, le segment est en fait
    // coupé par `col_box_gondola_end.002` (X∈[-1.25,0], Z∈[-8,-6.75]) : le
    // joueur démarre collé à la face est de ce capuchon, et la diagonale vers
    // l'allée le rase. Ce cas non plus n'était donc pas un échec d'occlusion.
    const gltf = await parseLevel("zone_c_rayons.glb");
    const { suit, ctx, physics } = rig(gltf, ZONE_C_SUIT_1);

    const hit = occluderPoint(physics, eyesAt(ZONE_C_SUIT_1), PLAYER_EYE);
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(-1.25, 2);

    suit.update(DT, ctx);
    expect(suit.state).toBe("idle");
  });

  it("Zone C, joueur entré dans l'allée : la ligne droite est dégagée, occlusion ou pas", async () => {
    // Le vrai piège de level design de la Zone C : il suffit que le joueur
    // fasse quelques pas dans l'allée pour que la rangée qui la borde ne
    // couvre plus rien — une allée est dégagée d'un bout à l'autre par
    // construction (voir level_spec.py::ZONE_C).
    const gltf = await parseLevel("zone_c_rayons.glb");
    const inAisle = new THREE.Vector3(-2.125, 0, -2);
    const { suit, ctx, physics } = rig(gltf, ZONE_C_SUIT_1, { playerFeet: inAisle });

    expect(occluderPoint(physics, eyesAt(ZONE_C_SUIT_1), eyesAt(inAisle))).toBeNull();

    suit.update(DT, ctx);
    expect(suit.state).toBe("alert");
  });

  it("Zone C, couloir latéral : la vue À TRAVERS une rangée de gondoles est bloquée", async () => {
    // three (-6, 0, -12) : couloir latéral ouest. Le rayon s'arrête en plein
    // sur le corps de la rangée ouest, `col_box_gondola_4m`
    // (X∈[-5.5,-4.25], Z∈[-12,-8]) — l'occlusion latérale franche que
    // l'ADR 0022 croyait absente, sans pilier ni coin pour l'expliquer.
    const gltf = await parseLevel("zone_c_rayons.glb");
    const lateral = new THREE.Vector3(-6, 0, -12);
    const { suit, ctx, physics } = rig(gltf, lateral);

    const hit = occluderPoint(physics, eyesAt(lateral), PLAYER_EYE);
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(-5.5, 2);

    suit.update(DT, ctx);
    expect(suit.state).toBe("idle");
  });
});

// ---------------------------------------------------------------------------
// Non-régression du correctif lui-même
// ---------------------------------------------------------------------------

describe("PhysicsWorld.refreshSceneQueries — rayon de ligne de vue", () => {
  it("un collider tout juste créé est invisible au rayon avant le premier pas, visible après", () => {
    const physics = new PhysicsWorld();
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(2, 1, 0.625).setTranslation(0, 1, -4),
      physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed()),
    );
    const ray = new RAPIER.Ray({ x: 0, y: 1, z: -8 }, { x: 0, y: 0, z: 1 });

    expect(physics.world.castRay(ray, 8, true)).toBeNull();
    physics.refreshSceneQueries();
    expect(physics.world.castRay(ray, 8, true)).not.toBeNull();
  });
});
