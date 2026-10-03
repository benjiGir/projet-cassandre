import { useGameStore } from "../../../../game/hud/state";
import styles from "./FpsCounter.module.css";

// see: docs/archive/systems-hud.md#composition-de-app
export function FpsCounter() {
  const fps = useGameStore((s) => Math.round(s.debug.fps));

  return <div className={styles.counter}>{`${String(fps).padStart(3, " ")} FPS`}</div>;
}
