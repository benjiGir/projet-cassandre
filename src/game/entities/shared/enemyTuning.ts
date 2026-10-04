/** Ce que la difficulté d'une partie change chez un ennemi — voir `game/session/progression/difficulty.ts`. */
export interface EnemyTuning {
  readonly hp: number;
  readonly damage: number;
}

export const NEUTRAL_ENEMY_TUNING: EnemyTuning = { hp: 1, damage: 1 };

/**
 * Configuration d'une espèce pour CETTE partie. Un réglage neutre rend la
 * configuration elle-même, pour que le panneau de tuning continue d'agir
 * dessus ; sinon une copie, et la config globale reste intacte.
 */
export function tuneEnemyConfig<T extends { maxHp: number; attackDamage: number }>(cfg: T, tuning: EnemyTuning): T {
  if (tuning.hp === 1 && tuning.damage === 1) return cfg;
  return {
    ...cfg,
    maxHp: Math.max(1, Math.round(cfg.maxHp * tuning.hp)),
    attackDamage: Math.max(1, Math.round(cfg.attackDamage * tuning.damage)),
  };
}
