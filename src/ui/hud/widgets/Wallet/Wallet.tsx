import { useGameStore } from "../../../../game/hud/state";
import { HudLabel } from "../../primitives/HudLabel/HudLabel";
import styles from "./Wallet.module.css";

// La cagnotte : les dons reçus pendant la partie.
// see: docs/decisions/0038-simulation-du-direct.md
export function Wallet() {
  const wallet = useGameStore((s) => s.debug.wallet);

  return (
    <div className={styles.wallet}>
      <HudLabel className={styles.label}>CAGNOTTE</HudLabel>
      <span className={styles.amount}>{`${wallet} €`}</span>
    </div>
  );
}
