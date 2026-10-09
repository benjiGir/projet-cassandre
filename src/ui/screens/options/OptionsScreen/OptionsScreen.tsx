import { useState } from "react";

import { Button } from "../../../components/controls/Button/Button";
import { ButtonRow } from "../../../components/controls/ButtonRow/ButtonRow";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { RecIndicator } from "../../../components/text/RecIndicator/RecIndicator";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Screen, type ScreenBackdrop } from "../../../components/layout/Screen/Screen";
import { ScreenTitle } from "../../../components/text/ScreenTitle/ScreenTitle";
import { AudioTab } from "../audio/AudioTab/AudioTab";
import { ControlsTab } from "../controls/ControlsTab/ControlsTab";
import { DisplayTab } from "../display/DisplayTab/DisplayTab";
import { OptionsTabs, type OptionsTab } from "../OptionsTabs/OptionsTabs";
import { TabBody } from "../TabBody/TabBody";
import styles from "./OptionsScreen.module.css";

export interface OptionsScreenProps {
  onBack: () => void;
  /** Transmis tel quel à `Screen` — voir sa doc. `PauseScreen` passe `"dim"`
   * pour garder le jeu visible derrière quand on ouvre les réglages EN jeu ;
   * le menu principal ne passe rien (opaque, comportement historique). */
  backdrop?: ScreenBackdrop;
}

// see: docs/archive/systems-hud.md#options-contrôles-et-affichage
export function OptionsScreen({ onBack, backdrop }: OptionsScreenProps) {
  const [tab, setTab] = useState<OptionsTab>("controles");

  return (
    <Screen backdrop={backdrop}>
      <Scanlines />
      <RecIndicator placement="corner">CONFIGURATION DU SIGNAL</RecIndicator>

      <CornerFrame className={styles.panel}>
        <ScreenTitle className={styles.title}>PARAMÈTRES</ScreenTitle>
        <OptionsTabs value={tab} onChange={setTab} />

        <TabBody key={tab} tab={tab}>
          {tab === "controles" && <ControlsTab />}
          {tab === "affichage" && <DisplayTab />}
          {tab === "audio" && <AudioTab />}
        </TabBody>

        <ButtonRow>
          <Button variant="primary" onClick={onBack}>
            ◀ RETOUR
          </Button>
        </ButtonRow>
      </CornerFrame>
    </Screen>
  );
}
