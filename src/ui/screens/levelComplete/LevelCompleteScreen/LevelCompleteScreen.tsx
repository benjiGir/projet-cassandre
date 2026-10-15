import { useGameStore } from "../../../../game/hud/state";
import { Button } from "../../../components/controls/Button/Button";
import { ButtonRow } from "../../../components/controls/ButtonRow/ButtonRow";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { RecapTable } from "../../../components/layout/RecapTable/RecapTable";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Screen } from "../../../components/layout/Screen/Screen";
import { ScreenTitle } from "../../../components/text/ScreenTitle/ScreenTitle";
import { StatusFlag } from "../../../components/text/StatusFlag/StatusFlag";
import { Vignette } from "../../../components/effects/Vignette/Vignette";
import { formatDuration } from "../../../lib/format";
import { LiveSummary } from "../LiveSummary/LiveSummary";
import styles from "./LevelCompleteScreen.module.css";

export interface LevelCompleteScreenProps {
  onReplay: () => void;
  onNextLevel?: () => void;
  onReturnToMenu: () => void;
}

// see: docs/archive/systems-hud.md#écrans-de-mort-et-de-fin-de-niveau
export function LevelCompleteScreen({ onReplay, onNextLevel, onReturnToMenu }: LevelCompleteScreenProps) {
  const flowState = useGameStore((s) => s.flowState);
  const recap = useGameStore((s) => s.recap);
  const live = useGameStore((s) => s.liveRecap);
  const nextAvailable = useGameStore((s) => s.campaign.nextAvailable);
  const metro = useGameStore((s) => s.campaign.levelId === "metro");
  if (flowState !== "levelComplete") return null;

  return (
    <Screen>
      <Vignette />
      <Scanlines />

      <CornerFrame className={styles.panel}>
        <StatusFlag>TRANSMISSION ACHEVÉE</StatusFlag>
        <ScreenTitle className={styles.title}>{metro ? "SORTIE DU MÉTRO" : "ÉCHAPPÉ D'HYPER VARAN"}</ScreenTitle>
        <p className={styles.body}>
          {metro
            ? "Le direct continue au-delà du réseau."
            : "Vidéo retirée, chaîne suspendue. Mais les images existent, et toi, tu es dehors."}
        </p>
        {live && <LiveSummary live={live} />}
        {recap && (
          <div className={styles.stats}>
            <span>{`Temps : ${formatDuration(recap.elapsedSeconds)}${recap.parTimeSeconds !== null ? ` / ${formatDuration(recap.parTimeSeconds)}` : ""}`}</span>
          </div>
        )}
        <RecapTable recap={recap} className={styles.recap} />

        <ButtonRow className={styles.actions}>
          {nextAvailable && onNextLevel && (
            <Button className={styles.actionButton} variant="primary" onClick={onNextLevel}>
              ▶ CONTINUER — MÉTRO
            </Button>
          )}
          <Button className={styles.actionButton} variant={nextAvailable ? "default" : "primary"} onClick={onReplay}>
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
