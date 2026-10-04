/**
 * Records (`game/settings/records.ts`) : tenus par niveau ET par difficulté.
 * En environnement node, sans `localStorage` : seule la mémoire du module est
 * exercée.
 */
import { afterEach, describe, expect, it } from "vitest";

import { recordFor, resetRecords, submitRun } from "../../../src/game/settings/records";

afterEach(() => {
  resetRecords();
});

describe("records", () => {
  it("la première partie terminée pose le record", () => {
    expect(recordFor("niveau_v2", "habitue")).toBeNull();
    expect(submitRun("niveau_v2", "habitue", 8000, 600)).toEqual({ best: 8000, isNew: true });
    expect(recordFor("niveau_v2", "habitue")).toEqual({ score: 8000, seconds: 600 });
  });

  it("un score plus bas ne bat rien, mais un meilleur temps reste acquis", () => {
    submitRun("niveau_v2", "habitue", 8000, 600);
    expect(submitRun("niveau_v2", "habitue", 5000, 480)).toEqual({ best: 8000, isNew: false });
    expect(recordFor("niveau_v2", "habitue")).toEqual({ score: 8000, seconds: 480 });
    expect(submitRun("niveau_v2", "habitue", 9000, 700)).toEqual({ best: 9000, isNew: true });
    expect(recordFor("niveau_v2", "habitue")).toEqual({ score: 9000, seconds: 480 });
  });

  it("chaque difficulté et chaque niveau tient son propre record", () => {
    submitRun("niveau_v2", "client", 12000, 400);
    expect(recordFor("niveau_v2", "habitue")).toBeNull();
    expect(recordFor("niveau_v2", "lanceur")).toBeNull();
    expect(recordFor("gym", "client")).toBeNull();
    expect(submitRun("niveau_v2", "lanceur", 3000, 900)).toEqual({ best: 3000, isNew: true });
  });
});
