// see: docs/6-reference/notes-code-gameplay-joueur.md#contrats-des-armes

export const LOYALTY_CARDS = ["argent", "or", "platine"] as const;

export type LoyaltyCard = (typeof LOYALTY_CARDS)[number];

/** Libellés affichés au joueur (HUD, messages) — jamais l'identifiant brut. */
export const LOYALTY_CARD_LABELS: Record<LoyaltyCard, string> = {
  argent: "Carte Argent",
  or: "Carte Or",
  platine: "Carte Platine",
};

export function parseLoyaltyCard(value: unknown): LoyaltyCard | null {
  if (typeof value !== "string") return null;
  const normalise = value.trim().toLowerCase();
  return (LOYALTY_CARDS as readonly string[]).includes(normalise) ? (normalise as LoyaltyCard) : null;
}
