/**
 * Cartes de fidélité — les clés du niveau v2 (jalon N7 de
 * `PLAN_NIVEAU_V2.md`), à la place du badge unique du Directeur.
 *
 * Trois cartes, ramassées puis présentées à une porte : Argent dans les
 * rayons, Or dans l'électroménager, Platine lâchée par le Directeur. Rien
 * ici ne connaît le niveau : quelle carte se trouve où, et quelle porte en
 * demande laquelle, est écrit dans le `.glb` (voir
 * `docs/reference/conventions-nommage.md#cartes-de-fidélité`), jamais dans ce
 * fichier.
 *
 * Source unique de la liste et de ses libellés. `game/state.ts` redéclare
 * l'union à l'identique plutôt que d'importer d'ici, parce qu'il est une
 * feuille de dépendances ([ADR 0020](../../../docs/decisions/0020-state-feuille-de-dependances.md)) —
 * même précédent que `activeWeapon`. Le test
 * `test/game/player/loyaltyCards.test.ts` vérifie que les deux ne divergent
 * pas.
 */

export const LOYALTY_CARDS = ["argent", "or", "platine"] as const;

export type LoyaltyCard = (typeof LOYALTY_CARDS)[number];

/** Libellés affichés au joueur (HUD, messages) — jamais l'identifiant brut. */
export const LOYALTY_CARD_LABELS: Record<LoyaltyCard, string> = {
  argent: "Carte Argent",
  or: "Carte Or",
  platine: "Carte Platine",
};

/**
 * Valeur d'une propriété personnalisée Blender (`card` / `requires`) vers une
 * carte, ou `null` si ce n'en est pas une.
 *
 * Tolérant sur la casse et les espaces — une propriété tapée à la main dans
 * Blender, `"Or "` comme `"or"`, doit marcher. Tolérant sur RIEN d'autre :
 * une valeur inconnue renvoie `null`, et l'appelant en fait un avertissement
 * bruyant (voir `loader.ts`), jamais un silence.
 */
export function parseLoyaltyCard(value: unknown): LoyaltyCard | null {
  if (typeof value !== "string") return null;
  const normalise = value.trim().toLowerCase();
  return (LOYALTY_CARDS as readonly string[]).includes(normalise) ? (normalise as LoyaltyCard) : null;
}
