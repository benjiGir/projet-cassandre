/**
 * Calculs purs de la boucle d'eau positionnelle (`core/waterAmbienceMix.ts`)
 * — AUCUN import de `howler` dans le module testé, exprès : ce fichier
 * tourne sous Node (`vitest.config.ts`, `environment: "node"`), sans DOM ni
 * `AudioContext`, comme `random.test.ts`. `core/waterAmbience.ts` (le
 * `Howl` réel) n'est volontairement pas testé ici — même absence que
 * `core/audio.ts`/`core/music.ts`, non testables sans navigateur.
 */
import { describe, expect, it } from "vitest";

import {
  computeWaterAmbienceMix,
  jetGain,
  JET_FULL_GAIN_DISTANCE,
  JET_SILENCE_DISTANCE,
  PAN_MAX,
  smoothTowards,
  SUMMED_GAIN_CAP,
  type Vec3Like,
  type WaterAmbienceMix,
} from "../../src/core/waterAmbienceMix";

const ORIGIN: Vec3Like = { x: 0, y: 0, z: 0 };
const RIGHT: Vec3Like = { x: 1, y: 0, z: 0 };

/**
 * `computeWaterAmbienceMix` écrit dans un `out` fourni par l'appelant (zéro
 * allocation sur le chemin chaud, voir sa doc) — ce harnais de test fournit
 * un littéral frais à chaque appel, pour que chaque test reste indépendant.
 */
function mix(jets: readonly Vec3Like[], listenerRight: Vec3Like = RIGHT): WaterAmbienceMix {
  return computeWaterAmbienceMix(ORIGIN, listenerRight, jets, { gain: 0, pan: 0 });
}

describe("jetGain", () => {
  it("vaut 1 à distance nulle et à toute distance sous le seuil plein", () => {
    expect(jetGain(0)).toBe(1);
    expect(jetGain(JET_FULL_GAIN_DISTANCE)).toBe(1);
    expect(jetGain(JET_FULL_GAIN_DISTANCE - 0.1)).toBe(1);
  });

  it("vaut 0 au seuil de silence et au-delà", () => {
    expect(jetGain(JET_SILENCE_DISTANCE)).toBe(0);
    expect(jetGain(JET_SILENCE_DISTANCE + 5)).toBe(0);
  });

  it("est monotone décroissante entre les deux seuils (courbe douce, pas de rebond)", () => {
    const samples = 20;
    let previous = jetGain(JET_FULL_GAIN_DISTANCE);
    for (let i = 1; i <= samples; i++) {
      const distance = JET_FULL_GAIN_DISTANCE + ((JET_SILENCE_DISTANCE - JET_FULL_GAIN_DISTANCE) * i) / samples;
      const gain = jetGain(distance);
      expect(gain).toBeLessThanOrEqual(previous + 1e-9);
      previous = gain;
    }
  });

  it("a une dérivée quasi nulle aux deux bornes (smoothstep, pas de rampe linéaire)", () => {
    const epsilon = 1e-4;
    // Juste après le seuil plein : la pente doit être bien plus faible que la
    // pente moyenne de toute la plage — sinon ce serait une rampe linéaire.
    const slopeNearFull = (jetGain(JET_FULL_GAIN_DISTANCE) - jetGain(JET_FULL_GAIN_DISTANCE + epsilon)) / epsilon;
    const meanSlope = 1 / (JET_SILENCE_DISTANCE - JET_FULL_GAIN_DISTANCE);
    expect(slopeNearFull).toBeLessThan(meanSlope * 0.05);

    const slopeNearSilence = (jetGain(JET_SILENCE_DISTANCE - epsilon) - jetGain(JET_SILENCE_DISTANCE)) / epsilon;
    expect(slopeNearSilence).toBeLessThan(meanSlope * 0.05);
  });
});

describe("computeWaterAmbienceMix", () => {
  it("rend un silence centré sans aucun jet", () => {
    expect(mix([])).toEqual({ gain: 0, pan: 0 });
  });

  it("écrit dans `out` fourni et le renvoie (zéro allocation sur le chemin chaud)", () => {
    const out: WaterAmbienceMix = { gain: -1, pan: -1 };
    const result = computeWaterAmbienceMix(ORIGIN, RIGHT, [{ x: 1, y: 0, z: 0 }], out);
    expect(result).toBe(out);
    expect(out.gain).toBeCloseTo(1, 5);
  });

  it("rend le gain plein pour un seul jet tout proche", () => {
    const result = mix([{ x: 1, y: 0, z: 0 }]);
    expect(result.gain).toBeCloseTo(1, 5);
  });

  it("somme le gain de plusieurs jets proches, mais le plafonne", () => {
    const jets: Vec3Like[] = [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: -1, y: 0, z: 0 },
    ];
    const result = mix(jets);
    // Trois jets à gain 1 sommeraient à 3 sans plafond.
    expect(result.gain).toBe(SUMMED_GAIN_CAP);
  });

  it("deux jets proches sonnent plus fort qu'un seul, sans dépasser le plafond", () => {
    const one = mix([{ x: 1, y: 0, z: 0 }]);
    const two = mix([
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
    ]);
    expect(two.gain).toBeGreaterThan(one.gain);
    expect(two.gain).toBeLessThanOrEqual(SUMMED_GAIN_CAP);
  });

  it("panoramique à droite pour un jet sur la droite de l'écoutant", () => {
    const result = mix([{ x: 5, y: 0, z: 0 }]);
    expect(result.pan).toBeCloseTo(PAN_MAX, 5);
  });

  it("panoramique à gauche pour un jet sur la gauche de l'écoutant", () => {
    const result = mix([{ x: -5, y: 0, z: 0 }]);
    expect(result.pan).toBeCloseTo(-PAN_MAX, 5);
  });

  it("panoramique centré pour un jet droit devant (perpendiculaire à la droite)", () => {
    const result = mix([{ x: 0, y: 0, z: -5 }]);
    expect(result.pan).toBeCloseTo(0, 5);
  });

  it("ne dépasse jamais ±PAN_MAX même pour un jet très excentré et proche", () => {
    const result = mix([{ x: 0.3, y: 0, z: 0.01 }]);
    expect(Math.abs(result.pan)).toBeLessThanOrEqual(PAN_MAX + 1e-9);
  });

  it("ne plante pas et centre le panoramique quand l'écoutant est exactement sur le jet dominant", () => {
    const result = mix([{ x: 0, y: 0, z: 0 }]);
    expect(result.gain).toBeCloseTo(1, 5);
    expect(result.pan).toBe(0);
  });

  it("le panoramique suit le jet DOMINANT (le plus proche), pas la moyenne des jets", () => {
    // Un jet tout proche à droite (gain plein) et un jet lointain à gauche
    // (gain quasi nul) : le pan doit rester du côté du jet proche.
    const result = mix([
      { x: 1, y: 0, z: 0 },
      { x: -10.9, y: 0, z: 0 },
    ]);
    expect(result.pan).toBeGreaterThan(0);
  });
});

describe("smoothTowards", () => {
  it("atteint exactement la cible avec tau <= 0 (pas de lissage)", () => {
    expect(smoothTowards(0, 1, 1 / 60, 0)).toBe(1);
    expect(smoothTowards(0, 1, 1 / 60, -1)).toBe(1);
  });

  it("converge vers la cible sans jamais la dépasser", () => {
    let value = 0;
    const target = 1;
    const tau = 0.05;
    for (let i = 0; i < 200; i++) {
      value = smoothTowards(value, target, 1 / 60, tau);
      expect(value).toBeLessThanOrEqual(target + 1e-9);
    }
    expect(value).toBeCloseTo(target, 3);
  });

  it("un dt de zéro ne change rien", () => {
    expect(smoothTowards(0.42, 1, 0, 0.05)).toBeCloseTo(0.42, 9);
  });

  it("un lissage plus long converge plus lentement sur le même dt", () => {
    const afterShortTau = smoothTowards(0, 1, 0.02, 0.05);
    const afterLongTau = smoothTowards(0, 1, 0.02, 0.2);
    expect(afterShortTau).toBeGreaterThan(afterLongTau);
  });

  it("est indépendant du framerate : dix petits pas ≈ un grand pas de même durée totale", () => {
    const tau = 0.05;
    const totalDt = 0.1;
    let stepped = 0;
    for (let i = 0; i < 10; i++) stepped = smoothTowards(stepped, 1, totalDt / 10, tau);
    const single = smoothTowards(0, 1, totalDt, tau);
    expect(stepped).toBeCloseTo(single, 6);
  });
});
