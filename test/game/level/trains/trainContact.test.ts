/**
 * Contact mortel d'une rame : le volume balayé par chaque voiture entre deux
 * pas fixes, comparé au trajet de la capsule de l'acteur sur le même pas.
 * Aucun collider : la géométrie seule décide.
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { TRAIN_CAR_LENGTH, TRAIN_HEIGHT, TRAIN_WIDTH } from "../../../../src/game/level/trains/trainConfig";
import { trainTouchesActor } from "../../../../src/game/level/trains/trainContact";
import { distanceAlongRoute, poseOnRoute, routeLength } from "../../../../src/game/level/trains/trainPath";
import type { TrainActor, TrainPass, TrainRoute } from "../../../../src/game/level/trains/trainTypes";

const RADIUS = 0.35;
const HALF_HEIGHT = 0.9;
/** Avance d'une rame à 24 m/s sur un pas fixe. */
const STEP = 24 / 60;
/** Demi-longueur d'une voiture, jeu entre voitures déduit. */
const CAR_HALF_LENGTH = (TRAIN_CAR_LENGTH - 0.35) / 2;

const droite: TrainRoute = { id: "droite", points: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 200)] };
/** Cent mètres vers +Z, puis un virage à angle droit vers +X. */
const coude: TrainRoute = {
  id: "coude",
  points: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 100), new THREE.Vector3(100, 0, 100)],
};

function rame(route: TrainRoute, front: number, options: { previousFront?: number; cars?: number } = {}): TrainPass {
  return {
    lane: "A",
    route,
    arrival: 0,
    speed: 24,
    front,
    previousFront: options.previousFront ?? front - STEP,
    length: (options.cars ?? 3) * TRAIN_CAR_LENGTH,
  };
}

/** Un acteur debout, pieds à `y`, immobile sauf si `depuis` donne sa position au pas précédent. */
function acteur(x: number, z: number, options: { y?: number; depuis?: [number, number] } = {}): TrainActor {
  const y = (options.y ?? 0) + HALF_HEIGHT;
  const [px, pz] = options.depuis ?? [x, z];
  return {
    position: new THREE.Vector3(x, y, z),
    previous: new THREE.Vector3(px, y, pz),
    radius: RADIUS,
    halfHeight: HALF_HEIGHT,
  };
}

describe("trainPath — poses le long d'un trajet", () => {
  it("routeLength additionne les segments", () => {
    expect(routeLength(droite)).toBe(200);
    expect(routeLength(coude)).toBe(200);
  });

  it("distanceAlongRoute projette un point sur le segment le plus proche", () => {
    expect(distanceAlongRoute(droite, new THREE.Vector3(5, 0, 40))).toBeCloseTo(40);
    expect(distanceAlongRoute(coude, new THREE.Vector3(50, 0, 103))).toBeCloseTo(150);
    // Avant le début ou après la fin, la distance reste dans le trajet.
    expect(distanceAlongRoute(droite, new THREE.Vector3(0, 0, -30))).toBe(0);
    expect(distanceAlongRoute(droite, new THREE.Vector3(0, 0, 500))).toBe(200);
  });

  it("poseOnRoute suit le trajet et oriente la voiture entre ses bogies", () => {
    const position = new THREE.Vector3();
    const direction = new THREE.Vector3();

    poseOnRoute(droite, 60, position, direction);
    expect(position.toArray()).toEqual([0, 0, 60]);
    expect(direction.toArray()).toEqual([0, 0, 1]);

    poseOnRoute(coude, 150, position, direction);
    expect(position.x).toBeCloseTo(50);
    expect(position.z).toBeCloseTo(100);
    expect(direction.x).toBeCloseTo(1);
    expect(direction.z).toBeCloseTo(0);

    // À cheval sur le coude, la direction est la corde entre les deux bogies : ni l'un ni l'autre segment.
    poseOnRoute(coude, 100, position, direction);
    expect(direction.x).toBeCloseTo(Math.SQRT1_2);
    expect(direction.z).toBeCloseTo(Math.SQRT1_2);
  });
});

describe("trainTouchesActor — rame sur une voie droite", () => {
  // Voiture de tête d'une rame dont le nez est à 50 m : de 35,175 m à 49,825 m.
  const passage = rame(droite, 50);

  it("touche un joueur immobile au milieu de la voie", () => {
    expect(trainTouchesActor(passage, acteur(0, 45))).toBe(true);
  });

  it("touche sous chacune des trois voitures, pas derrière la dernière", () => {
    expect(trainTouchesActor(passage, acteur(0, 50 - 0.5 * TRAIN_CAR_LENGTH))).toBe(true);
    expect(trainTouchesActor(passage, acteur(0, 50 - 1.5 * TRAIN_CAR_LENGTH))).toBe(true);
    expect(trainTouchesActor(passage, acteur(0, 50 - 2.5 * TRAIN_CAR_LENGTH))).toBe(true);
    expect(trainTouchesActor(passage, acteur(0, 50 - 3 * TRAIN_CAR_LENGTH - 1))).toBe(false);
  });

  it("le flanc compte le rayon de la capsule, pas un centimètre de plus", () => {
    const flanc = TRAIN_WIDTH / 2 + RADIUS;
    expect(trainTouchesActor(passage, acteur(flanc - 0.05, 45))).toBe(true);
    expect(trainTouchesActor(passage, acteur(-(flanc - 0.05), 45))).toBe(true);
    expect(trainTouchesActor(passage, acteur(flanc + 0.05, 45))).toBe(false);
    expect(trainTouchesActor(passage, acteur(-(flanc + 0.05), 45))).toBe(false);
  });

  it("devant le nez, le joueur n'est touché qu'à portée de capsule", () => {
    const nez = 50 - TRAIN_CAR_LENGTH / 2 + CAR_HALF_LENGTH;
    expect(trainTouchesActor(passage, acteur(0, nez + RADIUS - 0.05))).toBe(true);
    expect(trainTouchesActor(passage, acteur(0, nez + RADIUS + 0.05))).toBe(false);
  });

  it("une voie libre ne tue personne", () => {
    expect(trainTouchesActor(rame(droite, 20), acteur(0, 45))).toBe(false);
  });
});

describe("trainTouchesActor — balayage entre deux pas", () => {
  it("un joueur qui traverse toute la voie en un pas est touché, bien qu'aucune de ses deux positions ne soit sous la rame", () => {
    const traversee = acteur(3, 45, { depuis: [-3, 45] });
    expect(trainTouchesActor(rame(droite, 50), traversee)).toBe(true);
    expect(trainTouchesActor(rame(droite, 20), traversee)).toBe(false);
  });

  it("une voiture qui saute par-dessus le joueur en un pas le touche quand même", () => {
    // Une seule voiture : de 15,175–29,825 m au pas précédent à 45,175–59,825 m à celui-ci.
    const saut = rame(droite, 60, { previousFront: 30, cars: 1 });
    expect(trainTouchesActor(saut, acteur(0, 37))).toBe(true);
    expect(trainTouchesActor(saut, acteur(0, 70))).toBe(false);
    expect(trainTouchesActor(saut, acteur(0, 5))).toBe(false);
  });
});

describe("trainTouchesActor — hauteur", () => {
  const passage = rame(droite, 50);

  it("au-dessus du toit ou sous la voie, pas de contact", () => {
    expect(trainTouchesActor(passage, acteur(0, 45, { y: TRAIN_HEIGHT + 0.1 }))).toBe(false);
    expect(trainTouchesActor(passage, acteur(0, 45, { y: -(2 * HALF_HEIGHT) - 0.1 }))).toBe(false);
  });

  it("la tête qui dépasse dans le gabarit suffit", () => {
    expect(trainTouchesActor(passage, acteur(0, 45, { y: -(2 * HALF_HEIGHT) + 0.1 }))).toBe(true);
    expect(trainTouchesActor(passage, acteur(0, 45, { y: TRAIN_HEIGHT - 0.1 }))).toBe(true);
  });

  it("la hauteur se mesure depuis la voie, y compris en altitude négative", () => {
    const enterree: TrainRoute = {
      id: "enterree",
      points: [new THREE.Vector3(0, -10, 0), new THREE.Vector3(0, -10, 200)],
    };
    expect(trainTouchesActor(rame(enterree, 50), acteur(0, 45, { y: -10 }))).toBe(true);
    expect(trainTouchesActor(rame(enterree, 50), acteur(0, 45, { y: 0 }))).toBe(false);
  });
});

describe("trainTouchesActor — rame en virage", () => {
  // Voiture de tête centrée à 150 m du départ : sur le second segment, en (50, 100).
  const passage = rame(coude, 157.5);

  it("la voiture suit le trajet après le coude", () => {
    expect(trainTouchesActor(passage, acteur(50, 100))).toBe(true);
    expect(trainTouchesActor(passage, acteur(50, 100 + TRAIN_WIDTH / 2 + RADIUS + 0.1))).toBe(false);
  });

  it("le prolongement en ligne droite de l'ancien segment reste sûr", () => {
    expect(trainTouchesActor(passage, acteur(0, 150))).toBe(false);
  });

  it("une voiture à cheval sur le coude touche à l'intérieur du virage", () => {
    // Centre de la voiture de tête exactement au coude, orientée à 45°.
    const auCoude = rame(coude, 107.5, { cars: 1 });
    expect(trainTouchesActor(auCoude, acteur(0, 100))).toBe(true);
    expect(trainTouchesActor(auCoude, acteur(4, 104))).toBe(true);
    expect(trainTouchesActor(auCoude, acteur(-6, 106))).toBe(false);
  });
});

describe("trainTouchesActor — portion visible du trajet", () => {
  const partielle: TrainRoute = { ...droite, id: "partielle", visibleStart: 50, visibleEnd: 150, visualPadding: 0 };

  it("une voiture pas encore entrée dans la portion visible ne tue pas", () => {
    // Voiture de tête centrée à 32,5 m : avant `visibleStart`.
    expect(trainTouchesActor(rame(partielle, 40), acteur(0, 32.5))).toBe(false);
    expect(trainTouchesActor(rame(droite, 40), acteur(0, 32.5))).toBe(true);
  });

  it("une voiture sortie de la portion visible ne tue plus", () => {
    // Voiture de tête centrée à 160 m : après `visibleEnd` ; la suivante, à 145 m, est encore visible.
    const passage = rame(partielle, 167.5);
    expect(trainTouchesActor(passage, acteur(0, 163))).toBe(false);
    expect(trainTouchesActor(passage, acteur(0, 145))).toBe(true);
  });

  it("la marge visuelle élargit la portion mortelle", () => {
    const elargie: TrainRoute = { ...partielle, visualPadding: 20 };
    expect(trainTouchesActor(rame(elargie, 40), acteur(0, 32.5))).toBe(true);
  });
});
