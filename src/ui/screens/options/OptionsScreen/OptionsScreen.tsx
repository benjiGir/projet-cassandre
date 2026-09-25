import { useState } from "react";

import { Button } from "../../../components/controls/Button/Button";
import { ButtonRow } from "../../../components/controls/ButtonRow/ButtonRow";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { RecIndicator } from "../../../components/text/RecIndicator/RecIndicator";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Screen, type ScreenBackdrop } from "../../../components/layout/Screen/Screen";
import { ScreenTitle } from "../../../components/text/ScreenTitle/ScreenTitle";
import { ControlsTab } from "../controls/ControlsTab/ControlsTab";
import { DisplayTab } from "../display/DisplayTab/DisplayTab";
import { OptionsTabs, type OptionsTab } from "../OptionsTabs/OptionsTabs";
import styles from "./OptionsScreen.module.css";

export interface OptionsScreenProps {
  onBack: () => void;
  /** Transmis tel quel à `Screen` — voir sa doc. `PauseScreen` passe `"dim"`
   * pour garder le jeu visible derrière quand on ouvre les réglages EN jeu ;
   * le menu principal ne passe rien (opaque, comportement historique). */
  backdrop?: ScreenBackdrop;
}

/**
 * Écran « Options » : contrôles et affichage, un seul bouton RETOUR. Monté
 * depuis DEUX endroits, sans rien savoir duquel — `onBack` seul décide de la
 * suite : le menu principal (`app/bootChoice.ts`, retour vers
 * `MainMenu`) et la pause en jeu (`ui/screens/pause/PauseScreen/PauseScreen.tsx`,
 * retour vers le menu de pause). Les quatre réglages de `DisplayTab`
 * s'appliquent à chaud dans les deux cas dès qu'un moteur existe (voir
 * `game/graphicsSettings.ts::registerRenderTarget`).
 * see: docs/systems/hud.md#options-contrôles-et-affichage
 * see: docs/systems/session.md#pause
 */
export function OptionsScreen({ onBack, backdrop }: OptionsScreenProps) {
  const [tab, setTab] = useState<OptionsTab>("controles");

  return (
    <Screen backdrop={backdrop}>
      <Scanlines />
      <RecIndicator placement="corner">CONFIGURATION DU SIGNAL</RecIndicator>

      <CornerFrame className={styles.panel}>
        <ScreenTitle className={styles.title}>PARAMÈTRES</ScreenTitle>
        <OptionsTabs value={tab} onChange={setTab} />

        <div id={`options-panel-${tab}`} role="tabpanel" aria-labelledby={`options-tab-${tab}`} tabIndex={0}>
          {tab === "controles" ? <ControlsTab /> : <DisplayTab />}
        </div>

        <ButtonRow className={styles.footer}>
          <Button variant="primary" onClick={onBack}>
            ◀ RETOUR
          </Button>
        </ButtonRow>
      </CornerFrame>
    </Screen>
  );
}
