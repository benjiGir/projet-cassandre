import { describe, expect, it } from "vitest";

import { ammoLabel, healthLevel } from "../../../../src/ui/hud/lib/hudFormat";

const AMMO = { shotgunAmmo: 4, shotgunMaxAmmo: 8, pistolAmmo: 11, pistolMaxAmmo: 15 };

describe("ammoLabel", () => {
  it("affiche le chargeur de l'arme à feu en main", () => {
    expect(ammoLabel({ ...AMMO, activeWeapon: "shotgun" })).toBe("4 / 8");
    expect(ammoLabel({ ...AMMO, activeWeapon: "pistol" })).toBe("11 / 15");
  });

  it("nomme l'arme quand elle n'a pas de munitions", () => {
    expect(ammoLabel({ ...AMMO, activeWeapon: "melee" })).toBe("PIED-DE-BICHE");
    expect(ammoLabel({ ...AMMO, activeWeapon: "none" })).toBe("À MAINS NUES");
  });
});

describe("healthLevel", () => {
  it("passe à l'orange à la moitié et au rouge au quart, bornes incluses", () => {
    expect(healthLevel(1)).toBe("ok");
    expect(healthLevel(0.51)).toBe("ok");
    expect(healthLevel(0.5)).toBe("warn");
    expect(healthLevel(0.26)).toBe("warn");
    expect(healthLevel(0.25)).toBe("critical");
    expect(healthLevel(0)).toBe("critical");
  });
});
