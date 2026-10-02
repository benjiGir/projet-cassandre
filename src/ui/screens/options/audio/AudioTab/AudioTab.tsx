import { useState } from "react";

import { isMusicEnabled, setMusicEnabled } from "../../../../../core/music";
import {
  getAudioSettings,
  resetAudioSettings,
  setAudioSettings,
  type AudioChannel,
  type AudioSettings,
} from "../../../../../game/audioSettings";
import { Button } from "../../../../components/controls/Button/Button";
import { ButtonRow } from "../../../../components/controls/ButtonRow/ButtonRow";
import { OptionSection } from "../../fields/OptionSection/OptionSection";
import { ToggleField } from "../../fields/ToggleField/ToggleField";
import { VolumeFader } from "../VolumeFader/VolumeFader";
import { AUDIO_CHANNELS } from "./audioChannels";
import styles from "./AudioTab.module.css";

/**
 * Onglet AUDIO : table de mixage par canal, musique, sous-titres et son en
 * arrière-plan. Persisté et appliqué à chaud par `game/audioSettings.ts`
 * (la musique par `core/music.ts`) ; ce composant ne fait que présenter.
 * see: docs/4-technique/audio-runtime.md#réglages-du-joueur
 */
export function AudioTab() {
  const [settings, setSettings] = useState<AudioSettings>(getAudioSettings);
  // `core/music.ts` n'est pas réactif : copie locale, resynchronisée à chaque bascule.
  const [musicOn, setMusicOn] = useState(isMusicEnabled);

  function update(partial: Partial<AudioSettings>) {
    setSettings(setAudioSettings(partial));
  }

  function handleVolume(channel: AudioChannel, percent: number) {
    update({ [channel]: percent / 100 });
  }

  function handleMusicToggle() {
    setMusicEnabled(!musicOn);
    setMusicOn(!musicOn);
  }

  function handleReset() {
    setSettings(resetAudioSettings());
    setMusicEnabled(true);
    setMusicOn(true);
  }

  return (
    <>
      <OptionSection title="TABLE DE MIXAGE" hint="100 % = le mixage d'origine. ▶ fait entendre le canal à son nouveau niveau.">
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
            label="Thème musical"
            pressed={musicOn}
            onText="ACTIVÉ"
            offText="COUPÉ"
            hint="touche M en jeu"
            onToggle={handleMusicToggle}
          />
          <ToggleField
            label="Sous-titres"
            pressed={settings.sousTitres}
            onText="AFFICHÉS"
            offText="MASQUÉS"
            hint="texte des répliques sous la webcam"
            onToggle={() => update({ sousTitres: !settings.sousTitres })}
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
