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
import styles from "./DeathScreen.module.css";

export interface DeathScreenProps {
  onReplay: () => void;
  onReturnToMenu: () => void;
}

/**
 * Écran de mort : le stream est coupé. `onReplay`/`onReturnToMenu` sont de
 * vrais resets en place, jamais un rechargement de page. Le récap est
 * PARTIEL (`game/session/score.ts::publishLevelRecap(session, false)`,
 * appelé par `handlePlayerHit`) : pas de bonus de rapidité puisque la sortie
 * n'a jamais été franchie — `.partialNote` ci-dessous le dit en toutes
 * lettres, la ligne "Rapidité" n'existe simplement pas dans `recap.lines`
 * plutôt que de l'expliquer par son absence.
 * see: docs/systems/hud.md#écrans-de-mort-et-de-fin-de-niveau
 * see: docs/decisions/0019-machine-xstate-flux-ecran.md
 */
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
