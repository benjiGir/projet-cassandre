import { useGameStore } from "../../../../game/hud/state";
import styles from "./PerkOffer.module.css";

// Invite d'une borne à portée : ce qu'elle vend, son prix, et si le solde
// suffit. Elle n'achète rien : l'achat se décide dans le pas fixe.
// see: src/game/session/progression/perks.ts
export function PerkOffer() {
  const offer = useGameStore((s) => s.perkOffer);
  const affordable = useGameStore((s) => s.perkOffer !== null && s.debug.wallet >= s.perkOffer.price);
  if (!offer) return null;

  const status = offer.sold ? "sold" : affordable ? "open" : "short";

  return (
    <div className={styles.offer} data-status={status} role="status" aria-live="polite">
      {!offer.sold && <span className={styles.key}>{offer.key}</span>}
      <span>{offer.label}</span>
      <span className={styles.effect}>{offer.effect}</span>
      <span className={styles.price}>{offer.sold ? "PLEIN" : `${offer.price} €`}</span>
    </div>
  );
}
