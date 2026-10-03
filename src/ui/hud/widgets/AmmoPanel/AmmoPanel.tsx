import { useGameStore } from "../../../../game/hud/state";
import { ammoLabel } from "../../lib/hudFormat";
import { HudLabel } from "../../primitives/HudLabel/HudLabel";
import { HudValue } from "../../primitives/HudValue/HudValue";
import styles from "./AmmoPanel.module.css";

export function AmmoPanel() {
  // Un seul sélecteur qui rend une chaîne : le panneau ne re-rend que si le
  const text = useGameStore((s) => ammoLabel(s.debug));

  return (
    <>
      <HudLabel className={styles.label}>MUNITIONS</HudLabel>
      <HudValue>{text}</HudValue>
    </>
  );
}
