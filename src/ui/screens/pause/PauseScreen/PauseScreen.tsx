import { useGameStore } from "../../../../game/hud/state";
import { Button } from "../../../components/controls/Button/Button";
import { ButtonRow } from "../../../components/controls/ButtonRow/ButtonRow";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Screen } from "../../../components/layout/Screen/Screen";
import { ScreenTitle } from "../../../components/text/ScreenTitle/ScreenTitle";
import { StatusFlag } from "../../../components/text/StatusFlag/StatusFlag";
import { Vignette } from "../../../components/effects/Vignette/Vignette";
import styles from "./PauseScreen.module.css";

export interface PauseScreenProps {
  onResume: () => void;
  onOptions: () => void;
  onReturnToMenu: () => void;
}

// see: docs/archive/systems-session.md#pause
export function PauseScreen({ onResume, onOptions, onReturnToMenu }: PauseScreenProps) {
  const flowState = useGameStore((s) => s.flowState);
  if (flowState !== "paused") return null;

  return (
    <Screen backdrop="dim">
      <Vignette />
      <Scanlines />
      <CornerFrame className={styles.panel}>
        <StatusFlag blinking>SIGNAL EN PAUSE</StatusFlag>
        <ScreenTitle className={styles.title}>STREAM EN PAUSE</ScreenTitle>
        <p className={styles.body}>La caméra tourne encore. Personne ne le sait.</p>

        <ButtonRow className={styles.actions}>
          <Button className={styles.actionButton} variant="primary" onClick={onResume}>
            ▶ REPRENDRE
          </Button>
          <Button className={styles.actionButton} onClick={onOptions}>
            ⚙ PARAMÈTRES
          </Button>
          <Button className={styles.actionButton} variant="danger" onClick={onReturnToMenu}>
            ◀ QUITTER VERS LE MENU
          </Button>
        </ButtonRow>
      </CornerFrame>
    </Screen>
  );
}
