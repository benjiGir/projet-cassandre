import type { WeaponKind } from "./weaponTypes";

export type OwnedWeapon = Exclude<WeaponKind, "none">;

export interface WeaponInventory {
  readonly owned: readonly OwnedWeapon[];
  readonly active: WeaponKind;
  readonly pistolAmmo: number;
  readonly shotgunAmmo: number;
}
