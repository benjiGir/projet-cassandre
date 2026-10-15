export interface WeaponBalanceConfig {
  /** Longueur axiale de la capsule de contact depuis les yeux, hors rayon. */
  meleeRange: number;
  meleeHitRadius: number;
  /** Intervalle en secondes ; ne bloque jamais les mouvements. */
  meleeCooldown: number;
  /** Dégâts par cible touchée. */
  meleeDamage: number;
  pistolCooldown: number;
  pistolDamage: number;
}

export const WEAPON_BALANCE_VARIANTS = {
  HISTORIQUE: {
    meleeRange: 2,
    meleeHitRadius: 0.45,
    meleeCooldown: 0.5,
    meleeDamage: 40,
    pistolCooldown: 0.22,
    pistolDamage: 12,
  },
  REVISE: {
    meleeRange: 1.6,
    meleeHitRadius: 0.3,
    meleeCooldown: 0.6,
    meleeDamage: 25,
    pistolCooldown: 0.22,
    pistolDamage: 18,
  },
} satisfies Record<string, WeaponBalanceConfig>;

export type WeaponBalanceVariant = keyof typeof WEAPON_BALANCE_VARIANTS;
