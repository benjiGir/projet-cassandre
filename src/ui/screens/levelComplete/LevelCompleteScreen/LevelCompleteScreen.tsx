import { useGameStore } from "../../../../game/state";
import { Button } from "../../../components/controls/Button/Button";
import { ButtonRow } from "../../../components/controls/ButtonRow/ButtonRow";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Screen } from "../../../components/layout/Screen/Screen";
import { ScreenTitle } from "../../../components/text/ScreenTitle/ScreenTitle";
import { StatusFlag } from "../../../components/text/StatusFlag/StatusFlag";
import { formatViews } from "../../../lib/format";
import styles from "./LevelCompleteScreen.module.css";

export interface LevelCompleteScreenProps {
  onReplay: () => void;
  onReturnToMenu: () => void;
}

/**
 * Écran de fin de niveau : la transmission est achevée. Pas de chrono — le
 * plan le marque optionnel.
 * see: docs/systems/hud.md#écrans-de-mort-et-de-fin-de-niveau
 */
export function LevelCompleteScreen({ onReplay, onReturnToMenu }: LevelCompleteScreenProps) {
  const flowState = useGameStore((s) => s.flowState);
  const views = useGameStore((s) => s.debug.views);
  const secretsFound = useGameStore((s) => s.debug.secretsFound);
  const secretsTotal = useGameStore((s) => s.debug.secretsTotal);
  if (flowState !== "levelComplete") return null;

  return (
    <Screen>
      <Scanlines />

      <CornerFrame className={styles.panel}>
        <StatusFlag>TRANSMISSION ACHEVÉE</StatusFlag>
        <ScreenTitle className={styles.title}>ÉCHAPPÉ DE L'HYPERMARCHÉ</ScreenTitle>
        <p className={styles.body}>Le monde n'est pas prêt à entendre la vérité. Mais toi, tu es dehors.</p>
        <div className={styles.stats}>
          <span>{`Spectateurs en direct : ${formatViews(views)}`}</span>
          <span>{`Secrets trouvés : ${secretsFound} / ${secretsTotal}`}</span>
        </div>

        <ButtonRow className={styles.actions}>
          <Button variant="primary" onClick={onReplay}>
            ▶ REJOUER
          </Button>
          <Button onClick={onReturnToMenu}>◀ RETOUR AU MENU</Button>
        </ButtonRow>
      </CornerFrame>
    </Screen>
  );
}
