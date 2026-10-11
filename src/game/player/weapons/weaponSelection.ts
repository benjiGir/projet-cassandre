import type { WeaponKind } from "./weaponTypes";

export const WEAPON_CAROUSEL_SECONDS = 1.6;

export function cycleWeapon(active: WeaponKind, available: readonly WeaponKind[], steps: number): WeaponKind {
  if (available.length === 0) return active;
  const index = Math.max(0, available.indexOf(active));
  const next = (((index + steps) % available.length) + available.length) % available.length;
  return available[next];
}
