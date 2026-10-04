/**
 * Relevé du portefeuille (`devtools/economy/economySim.ts`) : une partie type
 * rejouée à travers la simulation du direct, sur le parcours et les profils
 * de `economyProfiles.ts`.
 */
import { describe, expect, it } from "vitest";

import { PARCOURS, PROFILES } from "../../../../src/game/devtools/economy/economyProfiles";
import { simulateRun } from "../../../../src/game/devtools/economy/economySim";
import { ECONOMY_VARIANTS } from "../../../../src/game/devtools/economy/economyVariants";
import { PERKS } from "../../../../src/game/player/perks";

const B = ECONOMY_VARIANTS.B;

describe("relevé du portefeuille", () => {
  it("même graine, même relevé", () => {
    const a = simulateRun(PROFILES.normal, "habitue", B.prices, 7);
    const b = simulateRun(PROFILES.normal, "habitue", B.prices, 7);
    expect(a).toEqual(b);
    expect(a.kiosks.length).toBeGreaterThan(0);
  });

  it("passe devant les six bornes, une par perk, et retrouve celle du couloir au retour du parking", () => {
    const bornes = PARCOURS.flatMap((stop) => (stop.kiosk && !stop.detour ? [stop.kiosk] : []));
    expect([...new Set(bornes)].sort()).toEqual([...PERKS].sort());
    expect(bornes.filter((perk) => perk === "boisson")).toHaveLength(2);
  });

  it("ne compte comme utile que ce qui tombe avant la dernière borne : le don du Directeur arrive trop tard", () => {
    const run = simulateRun(PROFILES.normal, "habitue", B.prices, 3);
    expect(run.spendable).toBeLessThan(run.donated);
    expect(run.best).toBeGreaterThanOrEqual(run.bought.length);
  });
});
