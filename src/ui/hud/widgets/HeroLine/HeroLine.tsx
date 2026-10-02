import { useGameStore } from "../../../../game/state";
import styles from "./HeroLine.module.css";

// see: docs/archive/systems-hud.md#deux-canaux-de-message-hudmessage-et-heroline
export function HeroLine() {
  const line = useGameStore((s) => s.heroLine);
  if (!line) return null;

  return (
    <div className={styles.bubble} role="status" aria-live="polite">
      <span className={styles.speaker}>RÉVEIL_DU_PEUPLE dit :</span>
      {line}
    </div>
  );
}
