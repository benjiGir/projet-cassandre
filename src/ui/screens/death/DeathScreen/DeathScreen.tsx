import { useGameStore } from "../../../../game/state";
import { Button } from "../../../components/controls/Button/Button";
import { ButtonRow } from "../../../components/controls/ButtonRow/ButtonRow";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { RecapTable } from "../../../components/RecapTable/RecapTable";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Screen } from "../../../components/layout/Screen/Screen";
import { ScreenTitle } from "../../../components/text/ScreenTitle/ScreenTitle";
import { StatusFlag } from "../../../components/text/StatusFlag/StatusFlag";
import { TvStatic } from "../../../components/effects/TvStatic/TvStatic";
import { Vignette } from "../../../components/effects/Vignette/Vignette";
import { formatViews } from "../../../lib/format";
import { LiveCam } from "../../../hud/widgets/LiveCam/LiveCam";
import styles from "./DeathScreen.module.css";

export interface DeathScreenProps {
  onReplay: () => void;
  onReturnToMenu: () => void;
}

// see: docs/archive/systems-hud.md#écrans-de-mort-et-de-fin-de-niveau
export function DeathScreen({ onReplay, onReturnToMenu }: DeathScreenProps) {
  const flowState = useGameStore((s) => s.flowState);
  const views = useGameStore((s) => s.debug.views);
  const recap = useGameStore((s) => s.recap);
  if (flowState !== "dead") return null;

  return (
    <Screen tone="alert">
      <Vignette />
      <TvStatic />
      <Scanlines variant="bars" />

      <CornerFrame className={styles.panel}>
        <LiveCam />
        <StatusFlag blinking>SIGNAL PERDU</StatusFlag>
        <ScreenTitle className={styles.title}>STREAM COUPÉ</ScreenTitle>
        <p className={styles.body}>Ils ont eu ta connexion. Encore une preuve, pense les 200 abonnés restants.</p>
        <p className={styles.stat}>{`Spectateurs au moment de la coupure : ${formatViews(views)}`}</p>

        {recap && <p className={styles.partialNote}>RÉCAPITULATIF PARTIEL — coupé avant la sortie, aucun bonus de rapidité</p>}
        <RecapTable recap={recap} className={styles.recap} />

        <ButtonRow className={styles.actions}>
          <Button className={styles.actionButton} variant="primary" onClick={onReplay}>
            ▶ RECONNECTER
          </Button>
          <Button className={styles.actionButton} onClick={onReturnToMenu}>
            ◀ RETOUR AU MENU
          </Button>
        </ButtonRow>
      </CornerFrame>
    </Screen>
  );
}
