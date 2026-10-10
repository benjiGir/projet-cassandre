import { Button } from "../../../components/controls/Button/Button";
import { ButtonRow } from "../../../components/controls/ButtonRow/ButtonRow";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Screen } from "../../../components/layout/Screen/Screen";
import { ScreenTitle } from "../../../components/text/ScreenTitle/ScreenTitle";
import { StatusFlag } from "../../../components/text/StatusFlag/StatusFlag";
import { TvStatic } from "../../../components/effects/TvStatic/TvStatic";
import { Vignette } from "../../../components/effects/Vignette/Vignette";
import styles from "./CrashScreen.module.css";

export interface CrashScreenProps {
  /** Le message de l'erreur, tel quel : c'est ce qu'un joueur recopie dans un rapport de bug. */
  detail: string;
  onReload: () => void;
}

// L'écran de secours : le jeu s'est arrêté sur une erreur. Il ne lit ni le
// store ni le moteur — ils sont peut-être ce qui a cassé.
// see: docs/4-technique/interface-react.md#écran-de-secours
export function CrashScreen({ detail, onReload }: CrashScreenProps) {
  return (
    <Screen tone="alert">
      <Vignette />
      <TvStatic />
      <Scanlines variant="bars" />

      <CornerFrame className={styles.panel}>
        <StatusFlag blinking>RÉGIE HORS SERVICE</StatusFlag>
        <ScreenTitle className={styles.title}>LE DIRECT A PLANTÉ</ScreenTitle>
        <p className={styles.body}>
          Une erreur a arrêté le jeu. La partie en cours est perdue ; la progression de la campagne est conservée.
        </p>
        <p className={styles.detail}>{detail}</p>

        <ButtonRow className={styles.actions}>
          <Button className={styles.actionButton} variant="primary" onClick={onReload}>
            ↻ RELANCER LE JEU
          </Button>
        </ButtonRow>
      </CornerFrame>
    </Screen>
  );
}
