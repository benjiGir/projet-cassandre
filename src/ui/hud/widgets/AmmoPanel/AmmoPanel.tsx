import { useGameStore } from "../../../../game/state";
import { ammoLabel } from "../../lib/hudFormat";
import { HudLabel } from "../../primitives/HudLabel/HudLabel";
import { HudValue } from "../../primitives/HudValue/HudValue";
import styles from "./AmmoPanel.module.css";

/** Munitions de l'arme en main. */
export function AmmoPanel() {
  // Un seul sélecteur qui rend une chaîne : le panneau ne re-rend que si le
  // texte affiché change, pas à chaque écriture d'un compteur d'une autre arme.
  const text = useGameStore((s) => ammoLabel(s.debug));

  return (
    <>
      <HudLabel className={styles.label}>MUNITIONS</HudLabel>
      <HudValue>{text}</HudValue>
    </>
  );
}
