import { useGameStore } from "../../../../game/state";
import { Button } from "../../../components/controls/Button/Button";
import { ButtonRow } from "../../../components/controls/ButtonRow/ButtonRow";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { RecapTable } from "../../../components/RecapTable/RecapTable";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Screen } from "../../../components/layout/Screen/Screen";
import { ScreenTitle } from "../../../components/text/ScreenTitle/ScreenTitle";
import { StatusFlag } from "../../../components/text/StatusFlag/StatusFlag";
import { Vignette } from "../../../components/effects/Vignette/Vignette";
import { formatDuration, formatViews } from "../../../lib/format";
import styles from "./LevelCompleteScreen.module.css";

export interface LevelCompleteScreenProps {
  onReplay: () => void;
  onReturnToMenu: () => void;
}

/**
 * Écran de fin de niveau : la transmission est achevée. Le récap détaillé
 * (`state.recap`) vient de `game/session/score.ts::publishLevelRecap`,
 * poussé une fois par `game/session/doors.ts::triggerLevelComplete` — cet
 * écran ne CALCULE rien, il affiche. Le sous-titre ne garde que "spectateurs"
 * et "temps" (la blague du stream) : les secrets ont déjà leur propre ligne,
 * chiffrée en points, dans `RecapTable` — les répéter en tête aurait été le
 * même nombre affiché deux fois sans raison.
 * see: docs/systems/hud.md#écrans-de-mort-et-de-fin-de-niveau
 * see: docs/systems/session.md#récapitulatif-de-fin-de-partie
 */
export function LevelCompleteScreen({ onReplay, onReturnToMenu }: LevelCompleteScreenProps) {
  const flowState = useGameStore((s) => s.flowState);
  const views = useGameStore((s) => s.debug.views);
  const recap = useGameStore((s) => s.recap);
  if (flowState !== "levelComplete") return null;

  return (
    <Screen>
      <Vignette />
      <Scanlines />

      <CornerFrame className={styles.panel}>
        <StatusFlag>TRANSMISSION ACHEVÉE</StatusFlag>
        <ScreenTitle className={styles.title}>ÉCHAPPÉ DE L'HYPERMARCHÉ</ScreenTitle>
        <p className={styles.body}>Le monde n'est pas prêt à entendre la vérité. Mais toi, tu es dehors.</p>
        <div className={styles.stats}>
          <span>{`Spectateurs en direct : ${formatViews(views)}`}</span>
          {recap && (
            <span>{`Temps : ${formatDuration(recap.elapsedSeconds)}${recap.parTimeSeconds !== null ? ` / ${formatDuration(recap.parTimeSeconds)}` : ""}`}</span>
          )}
        </div>
        <RecapTable recap={recap} className={styles.recap} />

        <ButtonRow className={styles.actions}>
          <Button className={styles.actionButton} variant="primary" onClick={onReplay}>
            ▶ REJOUER
          </Button>
          <Button className={styles.actionButton} onClick={onReturnToMenu}>
            ◀ RETOUR AU MENU
          </Button>
        </ButtonRow>
      </CornerFrame>
    </Screen>
  );
}
