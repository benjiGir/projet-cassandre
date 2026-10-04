/**
 * Difficulté mémorisée (`game/settings/difficultySettings.ts`). En
 * environnement node, sans `localStorage` : seule la mémoire du module est
 * exercée.
 */
import { afterEach, describe, expect, it } from "vitest";

import { getDifficulty, resetDifficulty, setDifficulty } from "../../../src/game/settings/difficultySettings";

afterEach(() => {
  resetDifficulty();
});

describe("difficulté mémorisée", () => {
  it("part sur « Habitué » et garde le dernier choix", () => {
    expect(getDifficulty()).toBe("habitue");
    setDifficulty("lanceur");
    expect(getDifficulty()).toBe("lanceur");
  });
});
