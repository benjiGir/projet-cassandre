import { useGameStore } from "../../../../game/hud/state";
import styles from "./DonationAlert.module.css";

// Le don qui vient d'arriver, avec le mot du donateur. Le donateur mystère de
// l'histoire a sa propre teinte, et un badge quand il écrit sous un compte vérifié.
// see: docs/decisions/0038-simulation-du-direct.md
export function DonationAlert() {
  const donation = useGameStore((s) => s.donation);
  if (!donation) return null;

  return (
    <div className={styles.alert} data-mystery={donation.mystery} role="status" aria-live="polite">
      <div className={styles.head}>
        <span className={styles.pseudo}>{donation.pseudo}</span>
        {donation.verified && (
          <span className={styles.badge} role="img" aria-label="compte vérifié">
            ✓
          </span>
        )}
        <span className={styles.amount}>{`+${donation.amount} €`}</span>
      </div>
      <p className={styles.text}>{`« ${donation.text} »`}</p>
    </div>
  );
}
