/**
 * Voyage à bord de la rame : embarquement, fermeture des portes, accélération,
 * croisière, freinage, arrivée. La distance est une fonction du temps écoulé,
 * continue d'une phase à l'autre — c'est elle qui fait défiler le décor.
 */
import { describe, expect, it } from "vitest";

import { TrainRideSystem } from "../../../../src/game/level/trainRide/trainRideSystem";
import type { TrainRideConfig, TrainRidePhase } from "../../../../src/game/level/trainRide/trainRideTypes";

const DT = 1 / 60;
const REGLES: TrainRideConfig = { speed: 20, duration: 30, acceleration: 5, braking: 5, waveDelay: 10, combat: true };
/** Aire sous la courbe de vitesse : rampe de 5 s, croisière de 20 s, rampe de 5 s. */
const DISTANCE_TOTALE = 20 * (30 - 5 / 2 - 5 / 2);

/** Une rame partie, portes fermées, joueur à bord : le premier pas de simulation n'a pas encore couru. */
function enRoute(overrides: Partial<TrainRideConfig> = {}): TrainRideSystem {
  const system = new TrainRideSystem({ ...REGLES, ...overrides });
  system.enqueue("depart");
  system.update(DT, false, true);
  system.takeEvents();
  return system;
}

function rouler(system: TrainRideSystem, seconds: number): void {
  for (let pas = 0; pas < Math.round(seconds / DT); pas++) system.update(DT, true, true);
}

describe("TrainRideSystem — départ", () => {
  it("attend à quai tant que personne ne demande le départ", () => {
    const system = new TrainRideSystem(REGLES);

    rouler(system, 5);

    expect(system.state).toEqual({ phase: "boarding", elapsed: 0, distance: 0, speed: 0, remaining: 0 });
    expect(system.takeEvents()).toEqual([]);
  });

  it("refuse le départ si le joueur n'est pas à bord", () => {
    const system = new TrainRideSystem(REGLES);

    system.enqueue("depart");
    system.update(DT, true, false);

    expect(system.state.phase).toBe("boarding");
    expect(system.takeEvents()).toEqual([]);
  });

  it("joueur à bord : annonce le départ et attend la fermeture des portes sans bouger", () => {
    const system = new TrainRideSystem(REGLES);

    system.enqueue("depart");
    system.update(DT, false, true);
    expect(system.state.phase).toBe("closing");
    expect(system.takeEvents()).toEqual(["depart"]);

    for (let pas = 0; pas < 120; pas++) system.update(DT, false, true);
    expect(system.state).toMatchObject({ phase: "closing", elapsed: 0, distance: 0, speed: 0 });
  });

  it("si le joueur ressort avant la fermeture, la rame revient à quai et le signale", () => {
    const system = enRoute();

    system.update(DT, false, false);

    expect(system.state.phase).toBe("boarding");
    expect(system.takeEvents()).toEqual(["reset"]);
  });

  it("portes fermées : le temps du voyage commence à zéro", () => {
    const system = enRoute();

    system.update(DT, true, true);

    expect(system.state.phase).toBe("accelerating");
    expect(system.state.elapsed).toBeCloseTo(DT);
    expect(system.state.remaining).toBeCloseTo(30 - DT);
  });
});

describe("TrainRideSystem — phases du voyage", () => {
  it("accélère, roule, freine, puis arrive à l'heure dite", () => {
    const system = enRoute();
    const phases: TrainRidePhase[] = [];

    for (let pas = 0; pas < Math.round(31 / DT); pas++) {
      system.update(DT, true, true);
      if (phases.at(-1) !== system.state.phase) phases.push(system.state.phase);
    }

    expect(phases).toEqual(["accelerating", "cruising", "braking", "arrived"]);
    expect(system.state).toMatchObject({ phase: "arrived", elapsed: 30, remaining: 0, speed: 0 });
  });

  it("chaque phase commence à l'instant prévu par la config", () => {
    const system = enRoute();

    rouler(system, 4.9);
    expect(system.state.phase).toBe("accelerating");
    rouler(system, 0.2);
    expect(system.state.phase).toBe("cruising");
    expect(system.state.speed).toBe(20);
    rouler(system, 19.8);
    expect(system.state.phase).toBe("cruising");
    rouler(system, 0.2);
    expect(system.state.phase).toBe("braking");
  });

  it("la distance parcourue est l'aire sous la courbe de vitesse", () => {
    const system = enRoute();

    rouler(system, 5);
    expect(system.state.distance).toBeCloseTo((20 * 5) / 2, 1);
    rouler(system, 10);
    expect(system.state.distance).toBeCloseTo((20 * 5) / 2 + 20 * 10, 1);
    rouler(system, 16);
    expect(system.state.distance).toBeCloseTo(DISTANCE_TOTALE, 6);
  });

  it("la distance ne recule jamais, ne saute jamais, et `previousDistance` suit d'un pas", () => {
    const system = enRoute();
    let precedente = 0;

    for (let pas = 0; pas < Math.round(31 / DT); pas++) {
      system.update(DT, true, true);
      const avance = system.state.distance - precedente;
      expect(system.previousDistance).toBe(precedente);
      expect(avance).toBeGreaterThanOrEqual(0);
      // Jamais plus vite que la vitesse de croisière : pas de saut aux raccords de phase.
      expect(avance).toBeLessThanOrEqual(20 * DT + 1e-9);
      precedente = system.state.distance;
    }
  });

  it("la vitesse reste entre zéro et la vitesse de croisière, sans marche aux raccords", () => {
    const system = enRoute();
    let precedente = 0;

    for (let pas = 0; pas < Math.round(29.9 / DT); pas++) {
      system.update(DT, true, true);
      expect(system.state.speed).toBeGreaterThanOrEqual(0);
      expect(system.state.speed).toBeLessThanOrEqual(20 + 1e-9);
      // Pente maximale du lissage : 1,5 × vitesse / durée de rampe.
      expect(Math.abs(system.state.speed - precedente)).toBeLessThanOrEqual(((1.5 * 20) / 5) * DT + 1e-9);
      precedente = system.state.speed;
    }
  });

  it("une fois arrivée, la rame ne bouge plus et n'annonce l'arrivée qu'une fois", () => {
    const system = enRoute({ combat: false });

    rouler(system, 31);
    expect(system.takeEvents()).toEqual(["arrived"]);

    rouler(system, 10);
    expect(system.takeEvents()).toEqual([]);
    expect(system.state.distance).toBeCloseTo(DISTANCE_TOTALE, 6);
    expect(system.previousDistance).toBe(system.state.distance);
  });
});

describe("TrainRideSystem — vague à bord", () => {
  it("part une seule fois, à `waveDelay`", () => {
    const system = enRoute();

    rouler(system, 9.9);
    expect(system.takeEvents()).toEqual([]);
    rouler(system, 0.2);
    expect(system.takeEvents()).toEqual(["wave"]);
    rouler(system, 15);
    expect(system.takeEvents()).toEqual([]);
  });

  it("sans combat, aucune vague", () => {
    const system = enRoute({ combat: false });

    rouler(system, 29);

    expect(system.takeEvents()).toEqual([]);
  });

  it("un délai trop long est ramené au début du freinage : la vague tombe toujours pendant le voyage", () => {
    const system = enRoute({ waveDelay: 500 });

    rouler(system, 24.9);
    expect(system.takeEvents()).toEqual([]);
    rouler(system, 0.2);
    expect(system.takeEvents()).toEqual(["wave"]);
  });
});

describe("TrainRideSystem — config hors bornes et remise à zéro", () => {
  it("un voyage dure au moins dix secondes et ses rampes au plus un tiers du voyage", () => {
    const system = enRoute({ duration: 3, acceleration: 50, braking: 50, combat: false });

    system.update(DT, true, true);
    expect(system.state.remaining).toBeCloseTo(10 - DT);

    rouler(system, 10 / 3 + 0.1);
    expect(system.state.phase).toBe("cruising");
    rouler(system, 10 / 3);
    expect(system.state.phase).toBe("braking");
    rouler(system, 10 / 3 + 0.1);
    expect(system.state.phase).toBe("arrived");
  });

  it("des rampes nulles ne divisent pas par zéro", () => {
    const system = enRoute({ acceleration: 0, braking: 0, combat: false });

    rouler(system, 31);

    expect(system.state.phase).toBe("arrived");
    expect(Number.isFinite(system.state.distance)).toBe(true);
    expect(system.state.distance).toBeCloseTo(20 * (30 - 0.1), 1);
  });

  it("`reset` en plein voyage ramène la rame à quai, distance comprise", () => {
    const system = enRoute();
    rouler(system, 12);
    system.takeEvents();

    system.enqueue("reset");
    system.update(DT, true, true);

    expect(system.state).toEqual({ phase: "boarding", elapsed: 0, distance: 0, speed: 0, remaining: 0 });
    expect(system.previousDistance).toBe(0);
    expect(system.takeEvents()).toEqual(["reset"]);
  });

  it("après un `reset`, un second voyage rejoue le même trajet, vague comprise", () => {
    const system = enRoute();
    rouler(system, 31);
    system.enqueue("reset");
    system.update(DT, true, true);
    system.takeEvents();

    system.enqueue("depart");
    system.update(DT, false, true);
    rouler(system, 31);

    expect(system.takeEvents()).toEqual(["depart", "wave", "arrived"]);
    expect(system.state.distance).toBeCloseTo(DISTANCE_TOTALE, 6);
  });

  it("une demande de départ en cours de voyage est sans effet", () => {
    const system = enRoute();
    rouler(system, 12);
    system.takeEvents();
    const avant = system.state.distance;

    system.enqueue("depart");
    system.update(DT, true, true);

    expect(system.state.phase).toBe("cruising");
    expect(system.state.distance).toBeGreaterThan(avant);
    expect(system.takeEvents()).toEqual([]);
  });
});
