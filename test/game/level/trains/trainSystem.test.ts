/**
 * Ordonnanceur des rames de ligne : annonce, entrée en voie, cadence,
 * commandes (arrêt, aiguillage, activation, passage unique, remise à zéro),
 * compte à rebours des signaux et avertissement sonore. Tout avance au pas
 * fixe, sans horloge murale.
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { TRAIN_CAR_COUNT, TRAIN_CAR_LENGTH } from "../../../../src/game/level/trains/trainConfig";
import { TrainSystem } from "../../../../src/game/level/trains/trainSystem";
import type { TrainConfig, TrainLaneDef, TrainRoute } from "../../../../src/game/level/trains/trainTypes";

const DT = 1 / 60;
const CONFIG: TrainConfig = {
  speed: 20,
  warning: 5,
  interval: 20,
  stopDuration: 8,
  stopCooldown: 30,
  visualWarning: true,
  soundWarning: true,
};
const TRAIN_LENGTH = TRAIN_CAR_COUNT * TRAIN_CAR_LENGTH;
const LOIN = new THREE.Vector3(500, 0, 500);
const ORIGINE = new THREE.Vector3(0, 0, 0);

const directe: TrainRoute = { id: "directe", points: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 200)] };
const deviee: TrainRoute = { id: "deviee", points: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(60, 0, 200)] };

function voie(overrides: Partial<TrainLaneDef> = {}): TrainLaneDef {
  return { id: "A", routes: [directe, deviee], firstArrival: 10, ...overrides };
}

/** Avance la simulation jusqu'à l'instant `until` (secondes depuis le début), pas fixe par pas fixe. */
function avancer(system: TrainSystem, horloge: { t: number }, until: number, listener = LOIN): void {
  while (horloge.t < until - 1e-9) {
    system.update(DT, listener);
    horloge.t += DT;
  }
}

function depart(definitions: readonly TrainLaneDef[] = [voie()], config: Partial<TrainConfig> = {}) {
  const system = new TrainSystem(definitions, { ...CONFIG, ...config });
  const horloge = { t: 0 };
  return { system, horloge, jusqua: (t: number, listener?: THREE.Vector3) => avancer(system, horloge, t, listener) };
}

describe("TrainSystem — horaire d'une voie", () => {
  it("annonce la rame `warning` secondes avant son heure, puis la fait entrer à l'heure", () => {
    const { system, jusqua } = depart();

    jusqua(4.9);
    expect(system.status("A", ORIGINE).pendingRoute).toBeNull();
    expect(system.passes).toHaveLength(0);

    jusqua(5.1);
    expect(system.status("A", ORIGINE).pendingRoute).toBe("directe");
    expect(system.passes).toHaveLength(0);

    jusqua(10.1);
    expect(system.passes).toHaveLength(1);
    expect(system.passes[0]).toMatchObject({ lane: "A", route: directe, arrival: 10, speed: 20, length: TRAIN_LENGTH });
    expect(system.passes[0].front).toBeGreaterThan(0);
    expect(system.passes[0].front).toBeLessThan(20 * 0.2);
  });

  it("le nez avance à `speed` et garde sa position du pas précédent pour le balayage", () => {
    const { system, jusqua } = depart();

    jusqua(12);

    const [pass] = system.passes;
    expect(pass.front).toBeCloseTo(20 * 2, 0);
    expect(pass.front - pass.previousFront).toBeCloseTo(20 * DT, 5);
  });

  it("retire la rame une fois sa queue sortie du trajet et programme la suivante à `interval`", () => {
    const { system, jusqua } = depart();
    const sortie = 10 + (200 + TRAIN_LENGTH) / 20;

    jusqua(sortie - 0.1);
    expect(system.passes).toHaveLength(1);
    jusqua(sortie + 0.1);
    expect(system.passes).toHaveLength(0);

    jusqua(29.9);
    expect(system.passes).toHaveLength(0);
    jusqua(30.1);
    expect(system.passes).toHaveLength(1);
    expect(system.passes[0].arrival).toBe(30);
  });

  it("la cadence ne descend jamais sous dix secondes, quelle que soit la config", () => {
    const { system, jusqua } = depart([voie()], { interval: 2 });

    jusqua(10.1);
    expect(system.passes[0].arrival).toBe(10);
    jusqua(20.1);
    expect(system.passes.map((pass) => pass.arrival)).toEqual([10, 20]);
  });

  it("une vitesse nulle ou négative est ramenée à 1 m/s : la rame finit toujours par sortir", () => {
    const { system, jusqua } = depart([voie()], { speed: 0 });

    jusqua(10.1);

    expect(system.passes[0].speed).toBe(1);
  });
});

describe("TrainSystem — compte à rebours d'un signal", () => {
  it("avant l'entrée : le temps jusqu'à l'heure, plus le trajet jusqu'au signal", () => {
    const { system } = depart();

    const auBout = system.status("A", new THREE.Vector3(0, 0, 100));

    expect(auBout.countdown).toBeCloseTo(10 + 100 / 20);
    expect(auBout.announced).toBe(false);
    expect(system.status("A", ORIGINE).countdown).toBeCloseTo(10);
  });

  it("devient « annoncé » quand il reste moins de `warning` secondes à CE point", () => {
    const { system, jusqua } = depart();
    const signal = new THREE.Vector3(0, 0, 100);

    jusqua(9.9);
    expect(system.status("A", signal).announced).toBe(false);
    jusqua(10.1);
    expect(system.status("A", signal).announced).toBe(true);
  });

  it("rame en voie : le compte suit son nez, puis repart sur la suivante une fois la queue passée", () => {
    const { system, jusqua } = depart();
    const signal = new THREE.Vector3(0, 0, 100);

    jusqua(12);
    expect(system.status("A", signal).countdown).toBeCloseTo((100 - 40) / 20, 1);

    // Le nez a dépassé le signal, la queue pas encore : toujours un danger.
    jusqua(16);
    expect(system.status("A", signal).countdown).toBeLessThan(0);
    expect(system.status("A", signal).announced).toBe(true);

    // Queue passée à 10 + (100 + 45) / 20 = 17,25 s : le compte vise la rame de 30 s.
    jusqua(18);
    expect(system.status("A", signal).countdown).toBeCloseTo(30 - 18 + 100 / 20, 1);
  });
});

describe("TrainSystem — arrêt du trafic", () => {
  it("retarde la prochaine rame de `stopDuration` et le dit", () => {
    const { system, jusqua } = depart();

    system.enqueue({ type: "stop", lane: "A" });
    jusqua(1);

    expect(system.takeFeedback()).toEqual(["Trafic retenu 8 s. Toute rame déjà annoncée passe."]);
    expect(system.status("A", ORIGINE).stopped).toBeCloseTo(7, 1);
    jusqua(17.9);
    expect(system.passes).toHaveLength(0);
    jusqua(18.1);
    expect(system.passes).toHaveLength(1);
  });

  it("une rame déjà annoncée passe quand même ; le retard se reporte sur la suivante", () => {
    const { system, jusqua } = depart();

    jusqua(6);
    system.enqueue({ type: "stop", lane: "A" });
    jusqua(10.1);
    expect(system.passes).toHaveLength(1);

    jusqua(37.9);
    expect(system.passes).toHaveLength(0);
    jusqua(38.1);
    expect(system.passes).toHaveLength(1);
    expect(system.passes[0].arrival).toBe(38);
  });

  it("n'est réutilisable qu'après `stopCooldown` : d'ici là, un refus chiffré et aucun retard de plus", () => {
    const { system, jusqua } = depart();
    system.enqueue({ type: "stop", lane: "A" });
    jusqua(1);
    system.takeFeedback();

    system.enqueue({ type: "stop", lane: "A" });
    jusqua(2);

    expect(system.takeFeedback()).toEqual(["Arrêt disponible dans 29 s"]);
    expect(system.status("A", ORIGINE).cooldown).toBeCloseTo(28, 1);
    jusqua(18.1);
    expect(system.passes).toHaveLength(1);

    jusqua(31);
    system.enqueue({ type: "stop", lane: "A" });
    jusqua(31.1);
    expect(system.takeFeedback()).toEqual(["Trafic retenu 8 s. Toute rame déjà annoncée passe."]);
  });
});

describe("TrainSystem — aiguillage", () => {
  it("sans trajet nommé, passe au trajet suivant et boucle", () => {
    const { system, jusqua } = depart();

    system.enqueue({ type: "switch", lane: "A" });
    jusqua(0.1);
    expect(system.status("A", ORIGINE).route).toBe("deviee");
    expect(system.takeFeedback()).toEqual(["Aiguillage : deviee. La rame annoncée garde sa route."]);

    system.enqueue({ type: "switch", lane: "A" });
    jusqua(0.2);
    expect(system.status("A", ORIGINE).route).toBe("directe");
  });

  it("vers un trajet nommé, quel que soit le trajet courant", () => {
    const { system, jusqua } = depart();

    system.enqueue({ type: "switch", lane: "A", route: "deviee" });
    system.enqueue({ type: "switch", lane: "A", route: "deviee" });
    jusqua(0.1);

    expect(system.status("A", ORIGINE).route).toBe("deviee");
  });

  it("la rame déjà annoncée garde son trajet ; la suivante prend le nouveau", () => {
    const { system, jusqua } = depart();

    jusqua(6);
    system.enqueue({ type: "switch", lane: "A" });
    jusqua(6.1);
    expect(system.status("A", ORIGINE)).toMatchObject({ route: "deviee", pendingRoute: "directe" });

    jusqua(10.1);
    expect(system.passes[0].route).toBe(directe);
    jusqua(30.1);
    expect(system.passes[0].route).toBe(deviee);
  });

  it("un trajet inconnu est une erreur bruyante, pas un aiguillage au hasard", () => {
    const { system } = depart();

    system.enqueue({ type: "switch", lane: "A", route: "fantome" });

    expect(() => system.update(DT, LOIN)).toThrow("Route de train inconnue : fantome");
  });
});

describe("TrainSystem — voie activée, désactivée, passage unique", () => {
  it("une voie née inactive ne fait passer personne et n'annonce rien", () => {
    const { system, jusqua } = depart([voie({ enabled: false })]);

    jusqua(60);

    expect(system.passes).toHaveLength(0);
    expect(system.status("A", ORIGINE)).toMatchObject({ enabled: false, countdown: Infinity, announced: false });
  });

  it("l'activer laisse toujours `warning` secondes avant la première rame", () => {
    const { system, jusqua } = depart([voie({ enabled: false })]);

    jusqua(20);
    system.enqueue({ type: "enable", lane: "A", enabled: true });
    jusqua(24.9);
    expect(system.passes).toHaveLength(0);
    jusqua(25.1);
    expect(system.passes).toHaveLength(1);
  });

  it("la désactiver arrête les annonces ; une rame déjà annoncée passe", () => {
    const { system, jusqua } = depart();

    jusqua(6);
    system.enqueue({ type: "enable", lane: "A", enabled: false });
    jusqua(10.1);
    expect(system.passes).toHaveLength(1);

    jusqua(60);
    expect(system.passes).toHaveLength(0);
    expect(system.status("A", ORIGINE).pendingRoute).toBeNull();
  });

  it("`pass` sur une voie inactive : une seule rame, `warning` secondes plus tard, puis la voie se referme", () => {
    const { system, jusqua } = depart([voie({ enabled: false })]);

    jusqua(3);
    system.enqueue({ type: "pass", lane: "A" });
    jusqua(7.9);
    expect(system.passes).toHaveLength(0);
    expect(system.status("A", ORIGINE).pendingRoute).toBe("directe");
    jusqua(8.1);
    expect(system.passes).toHaveLength(1);
    expect(system.status("A", ORIGINE).enabled).toBe(false);

    jusqua(90);
    expect(system.passes).toHaveLength(0);
  });

  it("`pass` sur une voie active avance la prochaine rame sans fermer la voie", () => {
    const { system, jusqua } = depart([voie({ firstArrival: 40 })]);

    system.enqueue({ type: "pass", lane: "A" });
    jusqua(5.1);
    expect(system.passes).toHaveLength(1);

    jusqua(25.1);
    expect(system.status("A", ORIGINE).enabled).toBe(true);
    expect(system.passes.at(-1)?.arrival).toBeCloseTo(25, 1);
  });
});

describe("TrainSystem — commandes hors norme", () => {
  it("une commande pour une voie inconnue est ignorée", () => {
    const { system, jusqua } = depart();

    system.enqueue({ type: "stop", lane: "Z" });
    system.enqueue({ type: "switch", lane: "Z" });
    jusqua(10.1);

    expect(system.takeFeedback()).toEqual([]);
    expect(system.passes).toHaveLength(1);
  });

  it("`reset` rejoue l'horaire depuis le début : rames, retards, aiguillage et messages oubliés", () => {
    const { system, jusqua, horloge } = depart();
    system.enqueue({ type: "switch", lane: "A" });
    system.enqueue({ type: "stop", lane: "A" });
    jusqua(19);
    expect(system.passes).toHaveLength(1);

    system.enqueue({ type: "reset" });
    system.update(DT, LOIN);
    horloge.t = DT;

    expect(system.passes).toHaveLength(0);
    expect(system.takeFeedback()).toEqual([]);
    expect(system.status("A", ORIGINE)).toMatchObject({ route: "directe", stopped: 0, cooldown: 0 });
    jusqua(10.1);
    expect(system.passes).toHaveLength(1);
    expect(system.passes[0].route).toBe(directe);
  });

  it("deux voies tiennent chacune leur horaire", () => {
    const { system, jusqua } = depart([voie(), voie({ id: "B", routes: [deviee], firstArrival: 14 })]);

    jusqua(10.1);
    expect(system.passes.map((pass) => pass.lane)).toEqual(["A"]);
    jusqua(14.1);
    expect(system.passes.map((pass) => pass.lane)).toEqual(["A", "B"]);
  });
});

describe("TrainSystem — contact et avertissement sonore", () => {
  const acteur = (z: number) => ({
    position: new THREE.Vector3(0, 0.9, z),
    previous: new THREE.Vector3(0, 0.9, z),
    radius: 0.35,
    halfHeight: 0.9,
  });

  it("`touches` ne répond qu'aux rames en voie, jamais à une rame seulement annoncée", () => {
    const { system, jusqua } = depart();

    jusqua(9);
    expect(system.touches(acteur(5))).toBe(false);
    jusqua(11);
    expect(system.touches(acteur(5))).toBe(true);
    expect(system.touches(acteur(150))).toBe(false);
  });

  it("un seul avertissement par rame, quand elle est à moins de `warning` secondes d'un auditeur proche de la voie", () => {
    const { system, jusqua } = depart();
    const auditeur = new THREE.Vector3(3, 0, 50);

    // Rame attendue à hauteur de l'auditeur à 10 + 50 / 20 = 12,5 s : avertie à partir de 7,5 s.
    jusqua(7.4, auditeur);
    expect(system.takeWarningSounds()).toBe(0);
    jusqua(7.6, auditeur);
    expect(system.takeWarningSounds()).toBe(1);
    jusqua(20, auditeur);
    expect(system.takeWarningSounds()).toBe(0);
  });

  it("aucun avertissement pour un auditeur à plus de vingt mètres de la voie", () => {
    const { system, jusqua } = depart();

    jusqua(20, new THREE.Vector3(25, 0, 50));

    expect(system.takeWarningSounds()).toBe(0);
  });
});
