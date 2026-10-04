import { offerPrice, perkPrices } from "../../player/perkConfig";
import { PERKS, type Perk, type PerkOffer } from "../../player/perks";
import { streamConfig, type StreamEventKind } from "../../session/stream/streamSim";
import type { MysteryBeat } from "../../session/stream/streamTexts";

// Variantes d'équilibrage de l'économie (lot B7) — même protocole que
// `FEEL_VARIANTS` : `cassandre.applyEconomyVariant("A")` en jeu, `pnpm economy`
// pour le relevé. Une variante règle trois choses : la générosité du chat, les
// dons du donateur mystère, et le prix des six perks.
//
// La variante B est celle que le jeu embarque : ses dons sont dans
// `streamConfig`, ses prix dans le niveau (`tools/blender/refresh_perk_kiosks.py`).
// Un test vérifie que les trois restent d'accord.

export interface EconomyVariant {
  readonly label: string;
  /** Multiplicateur de la probabilité de don des spectateurs, par rapport à `DONATION_REFERENCE`. */
  readonly generosity: number;
  readonly mystery: Readonly<Record<MysteryBeat, number>>;
  readonly prices: Readonly<Record<Perk, number>>;
}

/** Probabilités de don d'avant le lot B7 : la base que chaque variante multiplie. */
export const DONATION_REFERENCE: Readonly<Record<StreamEventKind | "serie", number>> = {
  kill: 0.12, serie: 0.5, boss: 1, secret: 0.6, casse: 0.05, degats: 0.04, toilettes: 0.5, carte: 0.4, moment: 0,
};

/**
 * L'état d'avant le lot B7, pour mémoire dans le relevé : quatre bornes
 * seulement, et le donateur mystère payait presque tout. Ne s'applique pas en
 * jeu — deux perks n'y avaient pas de prix.
 */
export const ECONOMY_BEFORE: EconomyVariant = {
  label: "avant B7 (référence)",
  generosity: 1,
  mystery: { depart: 1, carte_argent: 5, quai: 20, carte_or: 50, escalier: 100 },
  prices: { perche: 5, vpn: Infinity, aimant: Infinity, premium: 20, boisson: 50, gilet: 100 },
};

export const ECONOMY_VARIANTS = {
  /** A — SERRÉE : deux perks pour une partie normale, un seul en fonçant. Chaque achat en coûte un autre. */
  A: {
    label: "serrée",
    generosity: 1.3,
    mystery: { depart: 10, carte_argent: 10, quai: 10, carte_or: 20, escalier: 40 },
    prices: { perche: 10, vpn: 25, aimant: 30, premium: 40, boisson: 55, gilet: 90 },
  },
  /** B — ÉQUILIBRÉE : deux ou trois perks pour une partie normale. Celle du jeu. */
  B: {
    label: "équilibrée",
    generosity: 1.4,
    mystery: { depart: 10, carte_argent: 10, quai: 15, carte_or: 20, escalier: 45 },
    prices: { perche: 10, vpn: 20, aimant: 25, premium: 35, boisson: 55, gilet: 85 },
  },
  /** C — GÉNÉREUSE : trois perks pour une partie normale, quatre ou cinq en fouillant tout. Jamais les six. */
  C: {
    label: "généreuse",
    generosity: 1.8,
    mystery: { depart: 10, carte_argent: 10, quai: 15, carte_or: 25, escalier: 50 },
    prices: { perche: 10, vpn: 20, aimant: 25, premium: 30, boisson: 50, gilet: 80 },
  },
} as const satisfies Record<string, EconomyVariant>;

export type EconomyVariantId = keyof typeof ECONOMY_VARIANTS;

/** La variante que le jeu embarque. */
export const ECONOMY_DEFAULT: EconomyVariantId = "B";

/** Pose les dons d'une variante sur `streamConfig` — sans toucher aux prix. */
export function applyDonations(variant: EconomyVariant): void {
  for (const [kind, rule] of Object.entries(streamConfig.rules)) {
    const reference = DONATION_REFERENCE[kind as StreamEventKind | "serie"];
    rule.donation = Math.min(1, Math.round(reference * variant.generosity * 1000) / 1000);
  }
  Object.assign(streamConfig.mystery, variant.mystery);
}

/** Met une variante à l'essai : dons, donateur mystère, et prix imposés aux bornes par-dessus ceux du niveau. */
export function applyEconomyVariant(name: EconomyVariantId): EconomyVariant & { variant: EconomyVariantId } {
  const variant: EconomyVariant = ECONOMY_VARIANTS[name];
  applyDonations(variant);
  Object.assign(perkPrices, variant.prices);
  console.info(`[économie] variante ${name} (${variant.label}) appliquée`);
  return { variant: name, ...variant };
}

/** Prix des six perks tels que la partie les pratique : ceux des bornes du niveau, variante à l'essai comprise. Un perk sans borne est hors de prix. */
export function pricesInPlay(offers: readonly PerkOffer[]): Record<Perk, number> {
  return Object.fromEntries(
    PERKS.map((perk) => {
      const offer = offers.find((candidate) => candidate.perk === perk);
      return [perk, offer ? offerPrice(offer) : Infinity];
    }),
  ) as Record<Perk, number>;
}
