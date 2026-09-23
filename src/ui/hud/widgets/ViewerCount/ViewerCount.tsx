import { useGameStore } from "../../../../game/state";
import { formatViews } from "../../../lib/format";
import { HudLabel } from "../../primitives/HudLabel/HudLabel";
import { HudValue } from "../../primitives/HudValue/HudValue";
import styles from "./ViewerCount.module.css";

/** Le compteur de spectateurs, qui s'emballe à chaque kill : c'est la blague du HUD. */
export function ViewerCount() {
  const views = useGameStore((s) => s.debug.views);

  return (
    <div className={styles.viewers}>
      <HudLabel>SPECTATEURS EN DIRECT</HudLabel>
      <HudValue emphasis="glow" className={styles.count}>
        {formatViews(views)}
      </HudValue>
    </div>
  );
}
