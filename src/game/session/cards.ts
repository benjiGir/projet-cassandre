import { LOYALTY_CARD_LABELS, LOYALTY_CARDS, type LoyaltyCard } from "../player/loyaltyCards";
import { useGameStore } from "../state";
import { showHudMessage } from "./feedback";
import { type GameSession } from "./gameSession";

/**
 * Inventaire de cartes de fidélité (jalon N7) — remplace le booléen
 * `hasBadge` d'une seule clé.
 *
 * L'inventaire VIT dans la session (`session.cards`), pas dans le store
 * zustand : le store est un miroir pour le HUD, jamais la source de vérité
 * ([ADR 0020](../../../docs/decisions/0020-state-feuille-de-dependances.md),
 * et invariant #2 — React ne décide rien dans la boucle).
 *
 * see: docs/systems/session.md#cartes-de-fidélité
 */

/** La carte est-elle en poche ? */
export function hasCard(session: GameSession, card: LoyaltyCard): boolean {
  return session.cards.has(card);
}

/**
 * Ajoute une carte à l'inventaire. Retourne `false` si elle y était déjà —
 * un ramassage en double n'est pas une erreur (un hot reload remet les
 * `use_*` du niveau en place), juste un non-événement : ni message, ni
 * écriture dans le store.
 */
export function grantCard(session: GameSession, card: LoyaltyCard): boolean {
  if (session.cards.has(card)) return false;
  session.cards.add(card);
  syncCardsToStore(session);
  showHudMessage(`${LOYALTY_CARD_LABELS[card]} récupérée`);
  return true;
}

/**
 * Recopie l'inventaire dans le store pour le HUD. Appelé PONCTUELLEMENT (au
 * ramassage, au reset de partie), jamais par image — même discipline que
 * `setPlayerHp` (invariant #2).
 *
 * Ordre stable : celui de `LOYALTY_CARDS`, pas celui des ramassages, pour
 * que le HUD n'affiche pas les mêmes cartes dans un ordre différent d'une
 * partie à l'autre.
 */
export function syncCardsToStore(session: GameSession): void {
  useGameStore.getState().setCards(LOYALTY_CARDS.filter((card) => session.cards.has(card)));
}
