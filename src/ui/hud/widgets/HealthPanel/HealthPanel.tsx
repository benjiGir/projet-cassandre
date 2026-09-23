import { useGameStore } from "../../../../game/state";
import { cssVars } from "../../../lib/styleHelpers";
import { healthLevel } from "../../lib/hudFormat";
import { HudLabel } from "../../primitives/HudLabel/HudLabel";
import { HudValue } from "../../primitives/HudValue/HudValue";
import styles from "./HealthPanel.module.css";

/** Barre et compte de PV du joueur. */
export function HealthPanel() {
  const hp = useGameStore((s) => s.debug.playerHp);
  const maxHp = useGameStore((s) => s.debug.playerMaxHp);
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

  return (
    <>
      <HudLabel className={styles.label}>PV</HudLabel>
      <div className={styles.track}>
        <div className={styles.fill} data-level={healthLevel(ratio)} style={cssVars({ "--fill": ratio })} />
      </div>
      <HudValue className={styles.value}>{`${Math.max(0, Math.round(hp))} / ${maxHp}`}</HudValue>
    </>
  );
}
