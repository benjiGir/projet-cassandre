import type { DebugState } from "../../../game/state";

type AmmoFields = Pick<DebugState, "activeWeapon" | "shotgunAmmo" | "shotgunMaxAmmo" | "pistolAmmo" | "pistolMaxAmmo">;

/** Ce qu'affiche la ligne « munitions » : un pied-de-biche n'a pas de cartouches, des mains nues encore moins. */
export function ammoLabel(ammo: AmmoFields): string {
  switch (ammo.activeWeapon) {
    case "shotgun":
      return `${ammo.shotgunAmmo} / ${ammo.shotgunMaxAmmo}`;
    case "pistol":
      return `${ammo.pistolAmmo} / ${ammo.pistolMaxAmmo}`;
    case "melee":
      return "PIED-DE-BICHE";
    case "none":
      return "À MAINS NUES";
    default:
      return ammo.activeWeapon satisfies never;
  }
}

export type HealthLevel = "ok" | "warn" | "critical";

/** Palier de couleur de la barre de vie. */
export function healthLevel(ratio: number): HealthLevel {
  if (ratio <= 0.25) return "critical";
  if (ratio <= 0.5) return "warn";
  return "ok";
}
