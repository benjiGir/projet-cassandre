export type MuzzleFlashWeapon = "pistol" | "shotgun" | "flare";

interface MuzzleFlashPreset {
  color: number;
  intensity: number;
  range: number;
  width: number;
  length: number;
  offset: number;
  duration: number;
}

export const MUZZLE_FLASH_POOL_SIZE = 2;
export const MUZZLE_FLASH_PRESETS: Record<MuzzleFlashWeapon, MuzzleFlashPreset> = {
  pistol: { color: 0xffe5a0, intensity: 28, range: 4, width: 0.18, length: 0.22, offset: 0.012, duration: 3 / 60 },
  shotgun: { color: 0xffd984, intensity: 60, range: 6, width: 0.4, length: 0.4, offset: 0.018, duration: 5 / 60 },
  // Rouge de la fusée qui s'allume : large, court, et plus long à s'éteindre.
  flare: { color: 0xff6a4a, intensity: 70, range: 7, width: 0.34, length: 0.3, offset: 0.016, duration: 6 / 60 },
};
