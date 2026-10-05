import type { DebugState } from "../../../game/hud/hudTypes";

type AmmoFields = Pick<DebugState, "activeWeapon" | "shotgunAmmo" | "shotgunMaxAmmo" | "pistolAmmo" | "pistolMaxAmmo">;

export function ammoLabel(ammo: AmmoFields): string {
  switch (ammo.activeWeapon) {
    case "shotgun":
      return `${ammo.shotgunAmmo} / ${ammo.shotgunMaxAmmo}`;
    case "pistol":
      return `${ammo.pistolAmmo} / ${ammo.pistolMaxAmmo}`;
    case "melee":
      return "PIED-DE-BICHE";
    case "none":
      return "COUP DE PIED";
    default:
      return ammo.activeWeapon satisfies never;
  }
}

export type HealthLevel = "ok" | "warn" | "critical";

export function healthLevel(ratio: number): HealthLevel {
  if (ratio <= 0.25) return "critical";
  if (ratio <= 0.5) return "warn";
  return "ok";
}
