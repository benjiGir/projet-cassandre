import { useGameStore } from "../../../../game/state";
import styles from "./LoyaltyCards.module.css";

const CARD_LABELS = {
  argent: "ARGENT",
  or: "OR",
  platine: "PLATINE",
} as const;

/** Les cartes de fidélité en poche : les clés du niveau. */
export function LoyaltyCards() {
  const cards = useGameStore((s) => s.debug.cards);
  if (cards.length === 0) return null;

  return (
    <div className={styles.cards}>
      {cards.map((card) => (
        <span key={card} className={styles.card} data-card={card}>
          {CARD_LABELS[card]}
        </span>
      ))}
    </div>
  );
}
