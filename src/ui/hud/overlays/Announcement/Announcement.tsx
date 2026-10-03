import { useGameStore } from "../../../../game/hud/state";
import styles from "./Announcement.module.css";

// Annonce des haut-parleurs ou de l'interphone, en haut au centre : un canal
// distinct de la voix du héros et des messages système.
// see: docs/decisions/0037-script-de-niveau.md
export function Announcement() {
  const announcement = useGameStore((s) => s.announcement);
  if (!announcement) return null;

  return (
    <div className={styles.announcement} role="status" aria-live="polite">
      <span className={styles.speaker}>{announcement.speaker}</span>
      {announcement.text}
    </div>
  );
}
