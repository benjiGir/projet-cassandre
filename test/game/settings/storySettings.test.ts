/**
 * Mémoire des intros vues (`game/settings/storySettings.ts`). En environnement
 * node, sans `localStorage` : seule la mémoire du module est exercée.
 */
import { afterEach, describe, expect, it } from "vitest";

import { hasSeenIntro, markIntroSeen, resetSeenIntros } from "../../../src/game/settings/storySettings";

afterEach(() => {
  resetSeenIntros();
});

describe("intros vues", () => {
  it("une intro n'est vue qu'après avoir été marquée, niveau par niveau", () => {
    expect(hasSeenIntro("niveau_v2")).toBe(false);
    markIntroSeen("niveau_v2");
    expect(hasSeenIntro("niveau_v2")).toBe(true);
    expect(hasSeenIntro("autre_niveau")).toBe(false);
  });
});
