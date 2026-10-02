import { useGameStore } from "../../../../game/state";
import styles from "./HudMessage.module.css";

// see: docs/archive/systems-hud.md#deux-canaux-de-message-hudmessage-et-heroline
export function HudMessage() {
  const message = useGameStore((s) => s.hudMessage);
  if (!message) return null;

  return (
    <div className={styles.message} role="status" aria-live="polite">
      <span className={styles.tick} aria-hidden="true">
        ▌
      </span>{" "}
      {message}
    </div>
  );
}
