import type { PickupWeaponKind } from "./pickupTypes";

// Resynchroniser les rectangles avec weapon_pickups.json après génération de l’atlas.
export const WEAPON_ICON_ATLAS_URL = "assets/sprites/weapon_pickups.png";
export const WEAPON_ICON_ATLAS_SIZE = { width: 159, height: 72 };
export const WEAPON_ICON_RECTS: Record<PickupWeaponKind, { x: number; y: number; width: number; height: number }> = {
  melee: { x: 0, y: 0, width: 56, height: 56 },
  pistol: { x: 58, y: 0, width: 27, height: 27 },
  shotgun: { x: 87, y: 0, width: 72, height: 72 },
};

export const WEAPON_SPRITE_SIZE: Record<PickupWeaponKind, number> = {
  melee: 0.8,
  pistol: 0.8,
  shotgun: 1.1,
};

export const WEAPON_GLOW_MIN = 0.55;
export const WEAPON_GLOW_MAX = 1.3;
export const WEAPON_GLOW_SPEED = 1.4; // rad/s, déphasé du bob : ne se lit pas comme un clignotement mécanique

export const WEAPON_BOB_AMPLITUDE = 0.08;
export const WEAPON_BOB_SPEED = 2.1;
