// Les perks vendus par les bornes du niveau (`use_*` portant `perk` et `prix`).
// Chacun est un placement de produit que le héros accepte : une marque
// inventée, et ce que le produit change à la partie. Les valeurs de l'effet
// sont dans `perkConfig.ts`, son application dans `session/progression/perks.ts`.

export const PERKS = ["boisson", "vpn", "gilet", "premium", "perche", "aimant"] as const;

export type Perk = (typeof PERKS)[number];

export interface PerkInfo {
  /** Nom du produit, marque comprise — affiché au joueur, jamais l'identifiant brut. */
  readonly label: string;
  /** Ce que le perk change, en quelques mots, pour l'invite de la borne. */
  readonly effect: string;
}

/** `tools/blender/validate_level.py` lit ses clés ici : une entrée par ligne, `  cle: { label: "…`. */
export const PERK_INFO: Record<Perk, PerkInfo> = {
  boisson: { label: "Zone 51 Energy", effect: "pointe de vitesse après un kill" },
  vpn: { label: "VPN Faraday", effect: "les Costards vous repèrent de moins loin" },
  gilet: { label: "Gilet Alu-Tactique", effect: "PV maximum augmentés" },
  premium: { label: "Abonnement Vérité+", effect: "munitions maximum augmentées" },
  perche: { label: "Perche Titane", effect: "pied-de-biche plus violent" },
  aimant: { label: "Aimant Magnétips", effect: "ramassage de plus loin" },
};

/** Ce qu'une borne propose : un seul perk, à un prix fixé par le niveau. */
export interface PerkOffer {
  readonly perk: Perk;
  /** Euros. */
  readonly price: number;
}

export function parsePerk(value: unknown): Perk | null {
  if (typeof value !== "string") return null;
  const normalise = value.trim().toLowerCase();
  return (PERKS as readonly string[]).includes(normalise) ? (normalise as Perk) : null;
}
