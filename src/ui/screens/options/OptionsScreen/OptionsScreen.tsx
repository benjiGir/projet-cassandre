import { useState } from "react";

import { Button } from "../../../components/controls/Button/Button";
import { ButtonRow } from "../../../components/controls/ButtonRow/ButtonRow";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { RecIndicator } from "../../../components/text/RecIndicator/RecIndicator";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Screen } from "../../../components/layout/Screen/Screen";
import { ScreenTitle } from "../../../components/text/ScreenTitle/ScreenTitle";
import { ControlsTab } from "../controls/ControlsTab/ControlsTab";
import { DisplayTab } from "../display/DisplayTab/DisplayTab";
import { OptionsTabs, type OptionsTab } from "../OptionsTabs/OptionsTabs";
import styles from "./OptionsScreen.module.css";

export interface OptionsScreenProps {
  onBack: () => void;
}

/**
 * Écran « Options » depuis le menu principal : contrôles et affichage, un
 * seul bouton RETOUR. Il n'existe pas de menu de pause : les réglages se
 * changent avant de jouer (invariant #9, pas de système inventé pour ça).
 * see: docs/systems/hud.md#options-contrôles-et-affichage
 */
export function OptionsScreen({ onBack }: OptionsScreenProps) {
  const [tab, setTab] = useState<OptionsTab>("controles");

  return (
    <Screen>
      <Scanlines />
      <RecIndicator placement="corner">CONFIGURATION DU SIGNAL</RecIndicator>

      <CornerFrame className={styles.panel}>
        <ScreenTitle className={styles.title}>PARAMÈTRES</ScreenTitle>
        <OptionsTabs value={tab} onChange={setTab} />

        {tab === "controles" ? <ControlsTab /> : <DisplayTab />}

        <ButtonRow className={styles.footer}>
          <Button variant="primary" onClick={onBack}>
            ◀ RETOUR
          </Button>
        </ButtonRow>
      </CornerFrame>
    </Screen>
  );
}
