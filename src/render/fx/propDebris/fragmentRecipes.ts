import type { FragmentMaterial } from "./propDebrisTypes";

interface FragmentRecipe {
  count: number;
  width: number;
  length: number;
  thickness: number;
  maxWidth: number;
  maxLength: number;
  speed: number;
  drag: number;
  gravity: number;
  lifetime: number;
  tint: number;
  sourceTint: boolean;
}

const PANEL = {
  count: 6,
  width: 0.8,
  length: 0.8,
  thickness: 0.028,
  maxWidth: 1.1,
  maxLength: 1.3,
  speed: 0.75,
  drag: 1.8,
  gravity: 1,
  lifetime: 0,
  tint: 0xb49568,
  sourceTint: true,
};

export const FRAGMENT_RECIPES: Record<FragmentMaterial, FragmentRecipe> = {
  cardboard: PANEL,
  wood: { ...PANEL, count: 10, width: 0.3, thickness: 0.035, maxWidth: 0.4, speed: 1.4, drag: 0.5, tint: 0x987447 },
  glass: {
    ...PANEL,
    count: 14,
    width: 0.3,
    length: 0.4,
    thickness: 0.009,
    maxWidth: 0.3,
    maxLength: 0.45,
    speed: 2,
    drag: 0.25,
    tint: 0x92bac0,
    sourceTint: false,
  },
  metal: {
    ...PANEL,
    count: 7,
    width: 0.45,
    length: 0.55,
    thickness: 0.055,
    maxWidth: 0.55,
    maxLength: 0.65,
    speed: 1.1,
    drag: 0.3,
    tint: 0x929b99,
  },
  gas: {
    ...PANEL,
    count: 8,
    width: 0.5,
    length: 0.6,
    thickness: 0.065,
    maxWidth: 0.45,
    maxLength: 0.65,
    speed: 2.4,
    drag: 0.4,
    tint: 0xffffff,
    sourceTint: false,
  },
  electronics: {
    ...PANEL,
    count: 6,
    width: 0.45,
    length: 0.45,
    thickness: 0.05,
    maxWidth: 0.45,
    maxLength: 0.5,
    speed: 1.4,
    drag: 0.4,
    tint: 0x454b4d,
    sourceTint: false,
  },
  circuit: {
    ...PANEL,
    count: 2,
    width: 0.45,
    length: 0.5,
    thickness: 0.015,
    maxWidth: 0.3,
    maxLength: 0.4,
    speed: 1.3,
    drag: 0.8,
    tint: 0xffffff,
    sourceTint: false,
  },
  flour: {
    ...PANEL,
    count: 15,
    width: 0.16,
    length: 0.16,
    thickness: 0.15,
    maxWidth: 0.22,
    maxLength: 0.22,
    speed: 0.8,
    drag: 3,
    gravity: 0.03,
    lifetime: 0.75,
    tint: 0xe6dcc3,
    sourceTint: false,
  },
  water: {
    ...PANEL,
    count: 18,
    width: 0.07,
    length: 0.07,
    thickness: 0.13,
    maxWidth: 0.09,
    maxLength: 0.09,
    speed: 1.5,
    drag: 0.5,
    lifetime: 0.7,
    tint: 0x9dbfc4,
    sourceTint: false,
  },
};

export const FRAGMENT_MATERIALS = Object.keys(FRAGMENT_RECIPES) as FragmentMaterial[];
