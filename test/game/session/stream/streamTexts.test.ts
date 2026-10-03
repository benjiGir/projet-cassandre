import { describe, expect, it } from "vitest";

import {
  CHAT_LINES,
  DONATION_LINES,
  MYSTERY_DONATIONS,
  MYSTERY_DONOR,
  PSEUDOS,
  type ChatLine,
} from "../../../../src/game/session/stream/streamTexts";

const texte = (line: ChatLine) => (typeof line === "string" ? line : line.text);

describe("textes du direct", () => {
  it("chaque sujet a de quoi varier, sans doublon", () => {
    for (const [topic, lines] of Object.entries(CHAT_LINES)) {
      expect(lines.length, topic).toBeGreaterThanOrEqual(6);
      expect(new Set(lines.map(texte)).size, topic).toBe(lines.length);
    }
    for (const [topic, lines] of Object.entries(DONATION_LINES)) {
      expect(lines.length, topic).toBeGreaterThanOrEqual(2);
      expect(new Set(lines).size, topic).toBe(lines.length);
    }
  });

  it("une ligne tient dans la largeur du chat", () => {
    const toutes = [...Object.values(CHAT_LINES).flat().map(texte), ...Object.values(DONATION_LINES).flat()];
    for (const line of toutes) expect(line.length, line).toBeLessThanOrEqual(70);
    for (const { text } of Object.values(MYSTERY_DONATIONS)) expect(text.length, text).toBeLessThanOrEqual(80);
  });

  it("les pseudos sont uniques, et celui du donateur mystère n'est jamais tiré au hasard", () => {
    expect(new Set(PSEUDOS).size).toBe(PSEUDOS.length);
    expect(PSEUDOS).not.toContain(MYSTERY_DONOR);
  });

  it("les dons du donateur mystère grossissent au fil de l'histoire", () => {
    const montants = Object.values(MYSTERY_DONATIONS).map((don) => don.amount);
    expect(montants).toEqual([...montants].sort((a, b) => a - b));
  });
});
