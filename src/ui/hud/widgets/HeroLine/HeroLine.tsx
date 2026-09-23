import { useGameStore } from "../../../../game/state";
import styles from "./HeroLine.module.css";

/**
 * Réplique du héros, sous sa webcam : il commente sa propre vidéo. Canal
 * PERSONNAGE, distinct du canal système `HudMessage` ; l'effacement et le
 * délai entre deux répliques vivent côté appelant.
 * see: docs/systems/hud.md#deux-canaux-de-message-hudmessage-et-heroline
 */
export function HeroLine() {
  const line = useGameStore((s) => s.heroLine);
  if (!line) return null;

  return (
    <div className={styles.bubble}>
      <span className={styles.speaker}>RÉVEIL_DU_PEUPLE dit :</span>
      {line}
    </div>
  );
}
