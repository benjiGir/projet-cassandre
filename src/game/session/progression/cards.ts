import { LOYALTY_CARD_LABELS, LOYALTY_CARDS, type LoyaltyCard } from "../../player/loyaltyCards";
import { useGameStore } from "../../hud/state";
import { showHudMessage } from "../player/feedback";
import { type GameSession } from "../gameSession";

// see: docs/archive/systems-session.md#cartes-de-fidélité

/** La carte est-elle en poche ? */
export function hasCard(session: GameSession, card: LoyaltyCard): boolean {
  return session.cards.has(card);
}

// see: docs/6-reference/notes-code-gameplay.md#progression-et-fin
export function grantCard(session: GameSession, card: LoyaltyCard): boolean {
  if (session.cards.has(card)) return false;
  session.cards.add(card);
  session.heroPortrait.react("discover");
  syncCardsToStore(session);
  showHudMessage(`${LOYALTY_CARD_LABELS[card]} récupérée`);
  return true;
}

export function syncCardsToStore(session: GameSession): void {
  useGameStore.getState().setCards(LOYALTY_CARDS.filter((card) => session.cards.has(card)));
}
