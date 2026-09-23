import { useGameStore } from "../../../../game/state";
import styles from "./FpsCounter.module.css";

/**
 * Seul chiffre du panneau de debug qui a sa place devant le joueur : le build
 * de production le monte à la place de `DebugPanel`, au même coin. Arrondi
 * dans le sélecteur, il ne re-rend que quand le nombre affiché change.
 * see: docs/systems/hud.md#composition-de-app
 */
export function FpsCounter() {
  const fps = useGameStore((s) => Math.round(s.debug.fps));

  return <div className={styles.counter}>{`${String(fps).padStart(3, " ")} FPS`}</div>;
}
