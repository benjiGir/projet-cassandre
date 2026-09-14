import { describe, expect, it } from "vitest";

import type { ViewmodelClocks } from "../../src/game/player/weapons";
import { VIEWMODEL_TIMING as T, viewmodelAnimationAt, type ViewmodelAnimation } from "../../src/render/viewmodel";

const REPOS = 1e3;

function clocks(partial: Partial<ViewmodelClocks>): ViewmodelClocks {
  return { active: "shotgun", previous: "melee", sinceSwitch: REPOS, sinceMeleeFire: REPOS, sinceShotgunFire: REPOS, ...partial };
}

function anim(partial: Partial<ViewmodelClocks>): ViewmodelAnimation {
  return viewmodelAnimationAt(clocks(partial), { weapon: "none", lowered: 0, swing: 0, pump: 0 });
}

describe("viewmodelAnimationAt", () => {
  it("au repos : l'arme active, en place, immobile", () => {
    expect(anim({})).toEqual({ weapon: "shotgun", lowered: 0, swing: 0, pump: 0 });
  });

  it("changement d'arme : l'ancienne descend, puis la nouvelle remonte", () => {
    const descente = anim({ sinceSwitch: T.lower / 2 });
    expect(descente.weapon).toBe("melee");
    expect(descente.lowered).toBeCloseTo(0.5);

    const remontee = anim({ sinceSwitch: T.lower + T.raise / 2 });
    expect(remontee.weapon).toBe("shotgun");
    expect(remontee.lowered).toBeGreaterThan(0);
    expect(remontee.lowered).toBeLessThan(1);

    expect(anim({ sinceSwitch: T.lower + T.raise }).lowered).toBe(0);
  });

  it("depuis les mains nues, la nouvelle arme remonte sans attendre de descente", () => {
    const a = anim({ previous: "none", sinceSwitch: 0.01 });
    expect(a.weapon).toBe("shotgun");
    expect(a.lowered).toBeGreaterThan(0.8);
  });

  it("tirer pendant le changement remet l'arme en place aussitôt (invariant #10)", () => {
    const a = anim({ sinceSwitch: 0.05, sinceShotgunFire: 0.01 });
    expect(a).toMatchObject({ weapon: "shotgun", lowered: 0 });
  });

  it("le balayage frappe vite puis revient au repos", () => {
    expect(anim({ active: "melee", sinceMeleeFire: 0 }).swing).toBe(0);
    expect(anim({ active: "melee", sinceMeleeFire: T.strike }).swing).toBeCloseTo(1);
    expect(anim({ active: "melee", sinceMeleeFire: T.strike + T.recover }).swing).toBe(0);
  });

  it("le fût attend la fin du recul, recule, puis revient", () => {
    expect(anim({ sinceShotgunFire: T.pumpStart / 2 }).pump).toBe(0);
    expect(anim({ sinceShotgunFire: T.pumpStart + T.pumpBack }).pump).toBeCloseTo(1);
    expect(anim({ sinceShotgunFire: T.pumpStart + T.pumpBack + T.pumpForward }).pump).toBe(0);
  });

  it("le pompage se termine avant que le pompe puisse retirer", () => {
    expect(T.pumpStart + T.pumpBack + T.pumpForward).toBeLessThan(0.8); // `weaponConfig.shotgunCooldown`
  });
});
