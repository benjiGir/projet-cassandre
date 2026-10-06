export interface KickConfig {
  range: number;
  hitRadius: number;
  damage: number;
  cooldown: number;
  strike: number;
  hold: number;
  recover: number;
}

export const KICK_VARIANTS = {
  VIF: { cooldown: 0.42, strike: 0.07, hold: 0.03, recover: 0.18 },
  FRANC: { cooldown: 0.55, strike: 0.10, hold: 0.05, recover: 0.24 },
  LOURD: { cooldown: 0.72, strike: 0.14, hold: 0.07, recover: 0.34 },
} satisfies Record<string, Pick<KickConfig, "cooldown" | "strike" | "hold" | "recover">>;

export const kickConfig: KickConfig = {
  range: 1.45,
  hitRadius: 0.24,
  damage: 20,
  ...KICK_VARIANTS.FRANC,
};
