import type { WeaponBalanceConfig, WeaponBalanceVariant } from "../../../../../game/player/weapons/weaponBalance";
import type { TuningField } from "../../lib/tuningTypes";

export const BALANCE_VARIANT_NAMES: readonly WeaponBalanceVariant[] = ["HISTORIQUE", "REVISE"];

export const BALANCE_VARIANT_LABELS: Record<WeaponBalanceVariant, string> = {
  HISTORIQUE: "Historique — mêlée dominante",
  REVISE: "Révisé — pistolet renforcé",
};

export const MELEE_BALANCE_FIELDS = [
  { key: "meleeDamage", label: "Dégâts par cible", min: 20, max: 50, step: 1, decimals: 0 },
  { key: "meleeCooldown", label: "Intervalle entre deux coups", unit: "s", min: 0.3, max: 1, step: 0.01, decimals: 2 },
  { key: "meleeRange", label: "Portée axiale", unit: "m", min: 1, max: 2.5, step: 0.05, decimals: 2 },
  { key: "meleeHitRadius", label: "Rayon du contact", unit: "m", min: 0.1, max: 0.6, step: 0.01, decimals: 2 },
] satisfies ReadonlyArray<TuningField<keyof WeaponBalanceConfig>>;

export const PISTOL_BALANCE_FIELDS = [
  { key: "pistolDamage", label: "Dégâts par balle", min: 8, max: 30, step: 1, decimals: 0 },
  {
    key: "pistolCooldown",
    label: "Intervalle entre deux tirs",
    unit: "s",
    min: 0.12,
    max: 0.4,
    step: 0.01,
    decimals: 2,
  },
] satisfies ReadonlyArray<TuningField<keyof WeaponBalanceConfig>>;
