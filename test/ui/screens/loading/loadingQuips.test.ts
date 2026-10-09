import { describe, expect, it } from "vitest";

import {
  LOADING_QUIPS,
  METRO_LOADING_QUIPS,
  loadingQuips,
} from "../../../../src/ui/screens/loading/LoadingScreen/loadingQuips";

describe("phrases de l'écran de chargement", () => {
  it("le métro a les siennes, tout le reste garde celles du magasin", () => {
    expect(loadingQuips("metro")).toBe(METRO_LOADING_QUIPS);
    expect(loadingQuips("magasin")).toBe(LOADING_QUIPS);
    expect(loadingQuips(null)).toBe(LOADING_QUIPS);
  });

  it.each([
    ["magasin", LOADING_QUIPS],
    ["métro", METRO_LOADING_QUIPS],
  ])("%s : de quoi varier, sans doublon, sur une ligne", (_nom, quips) => {
    expect(quips.length).toBeGreaterThanOrEqual(10);
    expect(new Set(quips).size).toBe(quips.length);
    for (const quip of quips) expect(quip.length, quip).toBeLessThanOrEqual(55);
  });
});
