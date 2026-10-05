export type MuzzleFlashWeapon = "pistol" | "shotgun";

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
};
