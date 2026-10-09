import { useState } from "react";

import {
  getAudioSettings,
  resetAudioSettings,
  setAudioSettings,
  type AudioChannel,
  type AudioSettings,
} from "../../../../../game/settings/audioSettings";
import { Button } from "../../../../components/controls/Button/Button";
import { ButtonRow } from "../../../../components/controls/ButtonRow/ButtonRow";
import { OptionSection } from "../../fields/OptionSection/OptionSection";
import { ToggleField } from "../../fields/ToggleField/ToggleField";
import { VolumeFader } from "../VolumeFader/VolumeFader";
import { AUDIO_CHANNELS } from "./audioChannels";
import styles from "./AudioTab.module.css";

// see: docs/4-technique/audio-runtime.md#réglages-du-joueur
export function AudioTab() {
  const [settings, setSettings] = useState<AudioSettings>(getAudioSettings);

  function update(partial: Partial<AudioSettings>) {
    setSettings(setAudioSettings(partial));
  }

  function handleVolume(channel: AudioChannel, percent: number) {
    update({ [channel]: percent / 100 });
  }

  function handleReset() {
    setSettings(resetAudioSettings());
  }

  return (
    <>
      <OptionSection
        title="TABLE DE MIXAGE"
        hint="100 % = le mixage d'origine. ▶ fait entendre le canal à son nouveau niveau."
      >
        <div className={styles.mixer}>
          {AUDIO_CHANNELS.map((channel) => (
            <VolumeFader
              key={channel.id}
              label={channel.label}
              percent={Math.round(settings[channel.id] * 100)}
              onChange={(percent) => handleVolume(channel.id, percent)}
              onPreview={channel.preview}
            />
          ))}
        </div>
      </OptionSection>

      <OptionSection title="DIFFUSION">
        <div className={styles.toggles}>
          <ToggleField
            label="Sous-titres"
            pressed={settings.sousTitres}
            onText="AFFICHÉS"
            offText="MASQUÉS"
            hint="texte des répliques sous la webcam"
            onToggle={() => update({ sousTitres: !settings.sousTitres })}
          />
          <ToggleField
            label="Chat du direct"
            pressed={settings.chatDuDirect}
            onText="AFFICHÉ"
            offText="MASQUÉ"
            hint="messages des spectateurs, en bas à gauche"
            onToggle={() => update({ chatDuDirect: !settings.chatDuDirect })}
          />
          <ToggleField
            label="Fenêtre inactive"
            pressed={settings.muetEnArrierePlan}
            onText="SON COUPÉ"
            offText="SON GARDÉ"
            hint="quand le jeu perd le focus"
            onToggle={() => update({ muetEnArrierePlan: !settings.muetEnArrierePlan })}
          />
        </div>
      </OptionSection>

      <ButtonRow className={styles.reset}>
        <Button onClick={handleReset}>↺ RÉINITIALISER L'AUDIO</Button>
      </ButtonRow>
    </>
  );
}
