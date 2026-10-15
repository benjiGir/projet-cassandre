/**
 * Ce qu'un niveau fait de ses trains : les corps cinématiques des voitures
 * (ils arrêtent tirs, ennemis et props, jamais le joueur), les voitures
 * affichées, et le propriétaire `LevelTrains` qui les fait avancer ensemble
 * au pas fixe.
 */
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { LevelResources } from "../../../../src/game/level/loading/levelResources";
import { LevelTrains } from "../../../../src/game/level/trains/levelTrains";
import { TrainCarBodies } from "../../../../src/game/level/trains/trainCarBodies";
import {
  TRAIN_CAR_COUNT,
  TRAIN_CAR_LENGTH,
  TRAIN_HEIGHT,
  TRAIN_WIDTH,
} from "../../../../src/game/level/trains/trainConfig";
import type { TrainLevelData } from "../../../../src/game/level/trains/trainLevelData";
import { TrainSystem } from "../../../../src/game/level/trains/trainSystem";
import type { TrainConfig, TrainLaneDef, TrainRoute } from "../../../../src/game/level/trains/trainTypes";
import { GROUP, initPhysics, PhysicsWorld } from "../../../../src/physics/world";
import { TrainPresentation } from "../../../../src/render/environment/trainGym/trainPresentation";

await initPhysics();

const DT = 1 / 60;
const LOIN = new THREE.Vector3(500, 0, 500);
const CONFIG: TrainConfig = {
  speed: 20,
  warning: 5,
  interval: 20,
  stopDuration: 8,
  stopCooldown: 30,
  visualWarning: true,
  soundWarning: true,
};

const droite: TrainRoute = { id: "droite", points: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 200)] };
/** Même voie, dont seule la portion 50–150 m est en scène. */
const partielle: TrainRoute = { ...droite, id: "partielle", visibleStart: 50, visibleEnd: 150, visualPadding: 0 };

function voie(route: TrainRoute, firstArrival = 1): TrainLaneDef {
  return { id: "A", routes: [route], firstArrival };
}

function avancer(seconds: number, pas: () => void): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) pas();
}

describe("TrainCarBodies — corps cinématiques des voitures", () => {
  function monde(route: TrainRoute = droite) {
    const physics = new PhysicsWorld();
    const owned: RAPIER.RigidBody[] = [];
    const system = new TrainSystem([voie(route)], CONFIG);
    const bodies = new TrainCarBodies(physics, owned);
    const pas = () => {
      system.update(DT, LOIN);
      bodies.updateFixed(system);
      physics.world.step();
    };
    return { physics, owned, system, bodies, pas };
  }

  it("`prepare` crée d'avance trois corps par rame, tous inactifs, inscrits au niveau", () => {
    const { physics, owned, bodies } = monde();

    bodies.prepare(2);

    expect(physics.world.bodies.len()).toBe(2 * TRAIN_CAR_COUNT);
    expect(owned).toHaveLength(2 * TRAIN_CAR_COUNT);
    expect(owned.every((body) => !body.isEnabled())).toBe(true);
  });

  it("une rame en voie active ses corps, posés au centre de chaque voiture", () => {
    const { owned, system, bodies, pas } = monde();
    bodies.prepare(1);

    avancer(4, pas);

    const [pass] = system.passes;
    const actifs = owned.filter((body) => body.isEnabled());
    expect(actifs).toHaveLength(TRAIN_CAR_COUNT);
    const centres = actifs.map((body) => body.translation().z).sort((a, b) => b - a);
    centres.forEach((z, car) => expect(z).toBeCloseTo(pass.front - (car + 0.5) * TRAIN_CAR_LENGTH, 3));
    expect(actifs.every((body) => body.translation().x === 0 && body.translation().y === 0)).toBe(true);
  });

  it("le collider a le gabarit de la caisse, posé sur la voie", () => {
    const { physics, bodies } = monde();

    bodies.prepare(1);

    const collider = physics.world.colliders.getAll()[0];
    expect(collider.halfExtents()).toMatchObject({
      x: expect.closeTo(TRAIN_WIDTH / 2),
      y: expect.closeTo(TRAIN_HEIGHT / 2),
      z: expect.closeTo((TRAIN_CAR_LENGTH - 0.35) / 2),
    });
    expect(collider.translation().y).toBeCloseTo(TRAIN_HEIGHT / 2);
  });

  it("le joueur n'est pas dans les groupes du collider : la rame ne le pousse pas", () => {
    const { physics, bodies } = monde();

    bodies.prepare(1);

    const groupes = physics.world.colliders.getAll()[0].collisionGroups();
    const filtre = groupes & 0xffff;
    expect(groupes >>> 16).toBe(GROUP.WORLD);
    expect(filtre & GROUP.PLAYER).toBe(0);
    for (const cible of [GROUP.PLAYER_SHOT, GROUP.ENEMY_SHOT, GROUP.ENEMY, GROUP.PROP, GROUP.DEBRIS]) {
      expect(filtre & cible).toBe(cible);
    }
  });

  it("hors scène, une voiture n'a pas de corps actif : il s'active en entrant, posé sur place", () => {
    const { owned, system, bodies, pas } = monde(partielle);
    bodies.prepare(1);

    // Nez à 40 m : aucune voiture n'a atteint les 50 m.
    avancer(3, pas);
    expect(owned.some((body) => body.isEnabled())).toBe(false);

    // Nez à 70 m : seule la voiture de tête (centre à 62,5 m) est en scène.
    avancer(1.5, pas);
    const actifs = owned.filter((body) => body.isEnabled());
    expect(actifs).toHaveLength(1);
    expect(actifs[0].translation().z).toBeCloseTo(system.passes[0].front - TRAIN_CAR_LENGTH / 2, 3);

    // Nez à 170 m : la voiture de tête (162,5 m) est sortie, les deux autres sont en scène.
    avancer(5, pas);
    expect(owned.filter((body) => body.isEnabled())).toHaveLength(2);
  });

  it("une rame sortie rend ses corps : la suivante les réutilise sans en créer", () => {
    const { physics, owned, system, bodies, pas } = monde();
    bodies.prepare(1);

    avancer(15, pas);
    expect(system.passes).toHaveLength(0);
    expect(owned.some((body) => body.isEnabled())).toBe(false);

    avancer(10, pas);
    expect(system.passes).toHaveLength(1);
    expect(physics.world.bodies.len()).toBe(TRAIN_CAR_COUNT);
    expect(owned.filter((body) => body.isEnabled())).toHaveLength(TRAIN_CAR_COUNT);
  });

  it("sans réserve, les corps sont créés à l'entrée de la rame", () => {
    const { physics, owned, pas } = monde();

    avancer(4, pas);

    expect(physics.world.bodies.len()).toBe(TRAIN_CAR_COUNT);
    expect(owned).toHaveLength(TRAIN_CAR_COUNT);
  });

  it("`reset` désactive tout, `dispose` retire les corps du monde et de la liste du niveau, sans toucher aux autres", () => {
    const { physics, owned, bodies, pas } = monde();
    const etranger = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    owned.push(etranger);
    bodies.prepare(1);
    avancer(4, pas);

    bodies.reset();
    expect(owned.filter((body) => body !== etranger).some((body) => body.isEnabled())).toBe(false);

    bodies.dispose();
    expect(owned).toEqual([etranger]);
    expect(physics.world.bodies.len()).toBe(1);
  });
});

describe("TrainPresentation — voitures affichées", () => {
  function scene(route: TrainRoute = droite) {
    const root = new THREE.Group();
    const system = new TrainSystem([voie(route)], CONFIG);
    const presentation = new TrainPresentation(root);
    return { root, system, presentation };
  }

  it("`prepare` ajoute les voitures à la scène, cachées, et les expose pour l'amorçage des shaders", () => {
    const { root, presentation } = scene();

    presentation.prepare(2);

    expect(root.children).toHaveLength(2 * TRAIN_CAR_COUNT);
    expect(root.children.every((car) => !car.visible)).toBe(true);
    expect(presentation.warmMeshes).toHaveLength(2 * TRAIN_CAR_COUNT);
  });

  it("interpole la pose de chaque voiture entre deux pas fixes", () => {
    const { root, system, presentation } = scene();
    presentation.prepare(1);
    avancer(4, () => system.update(DT, LOIN));
    const [pass] = system.passes;

    presentation.interpolate(system, 0, 0);
    const avant = root.children.map((car) => car.position.z).sort((a, b) => b - a);
    presentation.interpolate(system, 1, 0);
    const apres = root.children.map((car) => car.position.z).sort((a, b) => b - a);

    expect(root.children.every((car) => car.visible)).toBe(true);
    expect(avant[0]).toBeCloseTo(pass.previousFront - TRAIN_CAR_LENGTH / 2, 4);
    expect(apres[0]).toBeCloseTo(pass.front - TRAIN_CAR_LENGTH / 2, 4);
    expect(apres[0] - avant[0]).toBeCloseTo(CONFIG.speed * DT, 4);
  });

  it("n'affiche que les voitures en scène", () => {
    const { root, system, presentation } = scene(partielle);
    presentation.prepare(1);

    avancer(3, () => system.update(DT, LOIN));
    presentation.interpolate(system, 1, 0);
    expect(root.children.filter((car) => car.visible)).toHaveLength(0);

    avancer(1.5, () => system.update(DT, LOIN));
    presentation.interpolate(system, 1, 0);
    expect(root.children.filter((car) => car.visible)).toHaveLength(1);
  });

  it("cache les voitures d'une rame sortie et les réutilise pour la suivante", () => {
    const { root, system, presentation } = scene();
    presentation.prepare(1);
    avancer(4, () => system.update(DT, LOIN));
    presentation.interpolate(system, 1, 0);

    avancer(11, () => system.update(DT, LOIN));
    presentation.interpolate(system, 1, 0);
    expect(root.children.some((car) => car.visible)).toBe(false);

    avancer(10, () => system.update(DT, LOIN));
    presentation.interpolate(system, 1, 0);
    expect(root.children).toHaveLength(TRAIN_CAR_COUNT);
    expect(root.children.every((car) => car.visible)).toBe(true);
  });

  it("`dispose` retire les voitures de la scène", () => {
    const { root, system, presentation } = scene();
    presentation.prepare(1);
    avancer(4, () => system.update(DT, LOIN));
    presentation.interpolate(system, 1, 0);

    presentation.dispose();

    expect(root.children).toHaveLength(0);
  });
});

describe("LevelTrains — propriétaire des trains d'un niveau", () => {
  /** Une voie le long de +Z, un feu, et une traversée de 4 m de large autour de z = 100. */
  function niveau() {
    const root = new THREE.Group();
    const physics = new PhysicsWorld();
    const resources = new LevelResources(root);
    const data: TrainLevelData = {
      lanes: [{ id: "A", routes: [droite], firstArrival: 10, enabled: true }],
      signals: [{ lane: "A", position: new THREE.Vector3(3, 2, 50), yaw: 0, appearance: "feu" }],
      commands: new Map([["use_arret", { type: "stop", lane: "A" }]]),
      navigationZones: [],
      crossings: [{ lane: "A", box: new THREE.Box3(new THREE.Vector3(-2, -1, 98), new THREE.Vector3(2, 3, 102)) }],
      refuges: [],
      visibleRoutes: [],
      model: new THREE.Group(),
    };
    const trains = new LevelTrains(root, physics, data, resources);
    return { root, physics, resources, trains };
  }

  const en = (x: number) => new THREE.Vector3(x, 0.9, 100);

  it("prépare deux rames par voie, corps et voitures", () => {
    const { physics, resources, trains } = niveau();

    expect(physics.world.bodies.len()).toBe(2 * TRAIN_CAR_COUNT);
    expect(resources.bodies).toHaveLength(2 * TRAIN_CAR_COUNT);
    expect(trains.presentation.warmMeshes).toHaveLength(2 * TRAIN_CAR_COUNT);
  });

  it("fait avancer l'horaire et les corps au même pas fixe", () => {
    const { resources, trains } = niveau();

    avancer(11, () => trains.fixed(DT, LOIN));

    expect(trains.system.passes).toHaveLength(1);
    expect(resources.bodies.filter((body) => body.isEnabled())).toHaveLength(TRAIN_CAR_COUNT);
  });

  it("un niveau masqué (racine suspendue par un rechargement) n'avance plus", () => {
    const { root, trains } = niveau();
    root.visible = false;

    avancer(30, () => trains.fixed(DT, LOIN));

    expect(trains.active).toBe(false);
    expect(trains.system.passes).toHaveLength(0);
    expect(trains.system.status("A", new THREE.Vector3()).countdown).toBeCloseTo(10);
  });

  it("`use` transmet la commande du boîtier nommé, et ignore les autres objets", () => {
    const { trains } = niveau();

    trains.use("use_trousse");
    trains.use("use_arret");
    trains.fixed(DT, LOIN);

    expect(trains.system.takeFeedback()).toHaveLength(1);
  });

  it("changer de difficulté change la cadence et remet l'horaire à zéro", () => {
    const { trains } = niveau();
    avancer(11, () => trains.fixed(DT, LOIN));

    trains.setDifficulty("lanceur");

    expect(trains.config.speed).toBe(30);
    expect(trains.system.config).toBe(trains.config);
    expect(trains.system.passes).toHaveLength(0);
  });

  it("`reset` vide la voie au pas suivant : rames, corps et traversées en cours", () => {
    const { resources, trains } = niveau();
    avancer(11, () => trains.fixed(DT, LOIN));
    trains.crossed(en(-1));

    trains.reset();
    trains.fixed(DT, LOIN);

    expect(trains.system.passes).toHaveLength(0);
    expect(resources.bodies.some((body) => body.isEnabled())).toBe(false);
    // L'entrée d'avant le reset est oubliée : ressortir de l'autre côté ne compte pas.
    expect(trains.crossed(en(4))).toBe(0);
  });

  it("le nettoyage du niveau retire corps et voitures", () => {
    const { root, physics, resources, trains } = niveau();
    expect(trains.presentation.warmMeshes.length).toBeGreaterThan(0);

    resources.dispose(physics);

    expect(physics.world.bodies.len()).toBe(0);
    expect(root.children).toHaveLength(0);
  });

  describe("crossed — traversées complètes de la voie", () => {
    it("entrer d'un côté et ressortir de l'autre compte une traversée", () => {
      const { trains } = niveau();

      expect(trains.crossed(en(-4))).toBe(0);
      expect(trains.crossed(en(-1))).toBe(0);
      expect(trains.crossed(en(1))).toBe(0);
      expect(trains.crossed(en(4))).toBe(1);
      expect(trains.crossed(en(5))).toBe(0);
    });

    it("rebrousser chemin ne compte pas", () => {
      const { trains } = niveau();

      trains.crossed(en(-1));
      trains.crossed(en(1));
      trains.crossed(en(-1));

      expect(trains.crossed(en(-4))).toBe(0);
    });

    it("chaque traversée compte, dans un sens comme dans l'autre", () => {
      const { trains } = niveau();

      trains.crossed(en(-1));
      expect(trains.crossed(en(4))).toBe(1);
      trains.crossed(en(1));
      expect(trains.crossed(en(-4))).toBe(1);
    });

    it("longer la voie sans y entrer ne compte pas", () => {
      const { trains } = niveau();

      for (let z = 90; z <= 110; z += 2) expect(trains.crossed(new THREE.Vector3(-4, 0.9, z))).toBe(0);
    });
  });
});
