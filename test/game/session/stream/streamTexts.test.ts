import { describe, expect, it } from "vitest";

import {
  METRO_MYSTERY_BEATS,
  MYSTERY_BEATS,
  MYSTERY_TEXTS,
  MYSTERY_DONOR,
  STORE_STREAM_TEXTS,
  type ChatLine,
  type StreamTexts,
} from "../../../../src/game/session/stream/streamTexts";
import { METRO_STREAM_TEXTS } from "../../../../src/game/session/stream/metroStreamTexts";
import { streamConfig } from "../../../../src/game/session/stream/streamSim";

const texte = (line: ChatLine) => (typeof line === "string" ? line : line.text);
const jeux: [string, StreamTexts][] = [
  ["magasin", STORE_STREAM_TEXTS],
  ["métro", METRO_STREAM_TEXTS],
];

describe.each(jeux)("textes du direct — %s", (_nom, textes) => {
  it("chaque sujet a de quoi varier, sans doublon", () => {
    for (const [topic, lines] of Object.entries(textes.chat)) {
      expect(lines.length, topic).toBeGreaterThanOrEqual(6);
      expect(new Set(lines.map(texte)).size, topic).toBe(lines.length);
    }
    for (const [topic, lines] of Object.entries(textes.donations)) {
      expect(lines.length, topic).toBeGreaterThanOrEqual(2);
      expect(new Set(lines).size, topic).toBe(lines.length);
    }
  });

  it("une ligne tient dans la largeur du chat", () => {
    const toutes = [...Object.values(textes.chat).flat().map(texte), ...Object.values(textes.donations).flat()];
    for (const line of toutes) expect(line.length, line).toBeLessThanOrEqual(70);
  });

  it("les pseudos sont uniques, et celui du donateur mystère n'est jamais tiré au hasard", () => {
    expect(new Set(textes.pseudos).size).toBe(textes.pseudos.length);
    expect(textes.pseudos).not.toContain(MYSTERY_DONOR);
  });
});

describe("donateur mystère", () => {
  it("un message tient dans l'alerte de don", () => {
    for (const text of Object.values(MYSTERY_TEXTS)) expect(text.length, text).toBeLessThanOrEqual(80);
  });

  it.each([
    ["magasin", MYSTERY_BEATS],
    ["métro", METRO_MYSTERY_BEATS],
  ])("ses dons grossissent au fil de l'histoire — %s", (_nom, beats) => {
    const montants = beats.map((beat) => streamConfig.mystery[beat]);
    expect(montants).toEqual([...montants].sort((a, b) => a - b));
  });

  it("chaque étape a son texte et son montant, sans reste", () => {
    const etapes = [...MYSTERY_BEATS, ...METRO_MYSTERY_BEATS].sort();
    expect(Object.keys(MYSTERY_TEXTS).sort()).toEqual(etapes);
    expect(Object.keys(streamConfig.mystery).sort()).toEqual(etapes);
  });
});

// see: docs/2-fonctionnel/histoire-metro.md#règles
describe("le métro ne révèle rien", () => {
  const tout = [
    ...Object.values(METRO_STREAM_TEXTS.chat).flat().map(texte),
    ...Object.values(METRO_STREAM_TEXTS.donations).flat(),
    ...METRO_MYSTERY_BEATS.map((beat) => MYSTERY_TEXTS[beat]),
  ];

  it.each(["couveuse", "œuf", "oeuf", "éclos", "serveur", "vendu"])("aucun texte du direct ne dit « %s »", (mot) => {
    expect(tout.filter((line) => line.toLowerCase().includes(mot))).toEqual([]);
  });

  it("le compte vérifié vouvoie et ne menace pas", () => {
    for (const beat of METRO_MYSTERY_BEATS) {
      expect(MYSTERY_TEXTS[beat], beat).toMatch(/\b(vous|votre|nous)\b/i);
      expect(MYSTERY_TEXTS[beat], beat).not.toMatch(/!|\bsinon\b|\bdernier\b/i);
    }
  });
});
