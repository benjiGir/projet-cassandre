import { useGameStore } from "../../../../game/state";
import { Button } from "../../../components/controls/Button/Button";
import { ButtonRow } from "../../../components/controls/ButtonRow/ButtonRow";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Screen } from "../../../components/layout/Screen/Screen";
import { ScreenTitle } from "../../../components/text/ScreenTitle/ScreenTitle";
import { StatusFlag } from "../../../components/text/StatusFlag/StatusFlag";
import { TvStatic } from "../../../components/effects/TvStatic/TvStatic";
import { formatViews } from "../../../lib/format";
import styles from "./DeathScreen.module.css";

export interface DeathScreenProps {
  onReplay: () => void;
  onReturnToMenu: () => void;
}

/**
 * Écran de mort : le stream est coupé. `onReplay`/`onReturnToMenu` sont de
 * vrais resets en place, jamais un rechargement de page.
 * see: docs/systems/hud.md#écrans-de-mort-et-de-fin-de-niveau
 * see: docs/decisions/0019-machine-xstate-flux-ecran.md
 */
export function DeathScreen({ onReplay, onReturnToMenu }: DeathScreenProps) {
  const flowState = useGameStore((s) => s.flowState);
  const views = useGameStore((s) => s.debug.views);
  if (flowState !== "dead") return null;

  return (
    <Screen tone="alert">
      <TvStatic />
      <Scanlines variant="bars" />

      <CornerFrame className={styles.panel}>
        <StatusFlag blinking>SIGNAL PERDU</StatusFlag>
        <ScreenTitle className={styles.title}>STREAM COUPÉ</ScreenTitle>
        <p className={styles.body}>Ils ont eu ta connexion. Encore une preuve, pense les 200 abonnés restants.</p>
        <p className={styles.stat}>{`Spectateurs au moment de la coupure : ${formatViews(views)}`}</p>

        <ButtonRow className={styles.actions}>
          <Button variant="primary" onClick={onReplay}>
            ▶ RECONNECTER
          </Button>
          <Button onClick={onReturnToMenu}>◀ RETOUR AU MENU</Button>
        </ButtonRow>
      </CornerFrame>
    </Screen>
  );
}
