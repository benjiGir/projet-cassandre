import { useGameStore } from "../../../../game/state";
import styles from "./HudMessage.module.css";

/**
 * Message système transitoire (porte déverrouillée, carte ramassée). Canal
 * SYSTÈME, distinct de la réplique du héros (`HeroLine`).
 * see: docs/systems/hud.md#deux-canaux-de-message-hudmessage-et-heroline
 */
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
