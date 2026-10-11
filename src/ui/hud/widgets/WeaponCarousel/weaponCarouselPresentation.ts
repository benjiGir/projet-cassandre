import type { DebugState, WeaponCarouselView } from "../../../../game/hud/hudTypes";

export type CarouselWeapon = WeaponCarouselView["active"];

export const WEAPON_LABELS: Record<CarouselWeapon, string> = {
  none: "COUP DE PIED",
  melee: "PIED-DE-BICHE",
  pistol: "PISTOLET",
  shotgun: "FUSIL À POMPE",
  flare: "PISTOLET DE DÉTRESSE",
};

export function carouselOffset(index: number, activeIndex: number, count: number): number {
  const offset = (index - activeIndex + count) % count;
  return offset > count / 2 ? offset - count : offset;
}

export function carouselAmmo(weapon: CarouselWeapon, state: DebugState): string {
  switch (weapon) {
    case "none":
    case "melee":
      return "∞";
    case "pistol":
      return String(state.pistolAmmo);
    case "shotgun":
      return String(state.shotgunAmmo);
    case "flare":
      return String(state.flareAmmo);
    default:
      return weapon satisfies never;
  }
}
