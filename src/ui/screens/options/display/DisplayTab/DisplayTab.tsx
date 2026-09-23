import { useState } from "react";

import {
  RESOLUTION_PRESETS,
  getFactoryDefaults,
  getGraphicsSettings,
  resetGraphicsSettings,
  setGraphicsSettings,
  type GraphicsSettings,
} from "../../../../../game/graphicsSettings";
import { Button } from "../../../../components/controls/Button/Button";
import { ButtonRow } from "../../../../components/controls/ButtonRow/ButtonRow";
import { ChoiceGroup } from "../../fields/ChoiceGroup/ChoiceGroup";
import { FILTRAGE_CHOICES } from "./displayChoices";
import { OptionSection } from "../../fields/OptionSection/OptionSection";
import { RangeField } from "../../fields/RangeField/RangeField";
import styles from "./DisplayTab.module.css";

const RESOLUTION_CHOICES = RESOLUTION_PRESETS.map((preset) => ({
  id: preset.id,
  label: `${preset.width}×${preset.height}`,
}));

const ORIGIN = RESOLUTION_PRESETS[0];

/**
 * Onglet AFFICHAGE : quatre réglages graphiques, persistés et appliqués par
 * `game/graphicsSettings.ts`. Ce composant ne fait que les présenter.
 * see: docs/systems/hud.md#options-contrôles-et-affichage
 */
export function DisplayTab() {
  const [settings, setSettings] = useState<GraphicsSettings>(getGraphicsSettings);
  const defaults = getFactoryDefaults();

  function update(partial: Partial<GraphicsSettings>) {
    setSettings(setGraphicsSettings(partial));
  }

  return (
    <>
      <OptionSection
        title="FILTRAGE DES TEXTURES LOINTAINES"
        hint="Ne change rien à la netteté de près — le gros pixel franc reste la règle (invariant #4). Change seulement le rendu des surfaces vues de loin ou de biais."
      >
        <ChoiceGroup
          label="Filtrage des textures lointaines"
          layout="column"
          value={settings.filtrage}
          choices={FILTRAGE_CHOICES}
          onChange={(filtrage) => update({ filtrage })}
        />
      </OptionSection>

      <OptionSection
        title="RÉSOLUTION INTERNE"
        hint={`${ORIGIN.width}×${ORIGIN.height} est la résolution d'ORIGINE du jeu (invariant #4) — les valeurs au-delà sont une comparaison, pas une amélioration.`}
      >
        <ChoiceGroup
          label="Résolution interne"
          value={settings.resolution}
          choices={RESOLUTION_CHOICES}
          onChange={(resolution) => update({ resolution })}
        />
      </OptionSection>

      <OptionSection
        title="CHAMP DE VISION"
        hint="Valeur au repos — s'élargit déjà automatiquement à la course, ce réglage ne touche que la base."
      >
        <RangeField
          label="Champ de vision"
          min={60}
          max={100}
          step={1}
          value={settings.fovBase}
          display={`${Math.round(settings.fovBase)}°`}
          onChange={(fovBase) => update({ fovBase })}
        />
      </OptionSection>

      <OptionSection
        title="INTENSITÉ DU SCREENSHAKE"
        hint="Secousse de la caméra sur un impact (mur ou ennemi). 100 % = intensité d'origine, 0 % = désactivée."
      >
        <RangeField
          label="Intensité du screenshake"
          min={0}
          max={100}
          step={5}
          value={Math.round(settings.shakeIntensity * 100)}
          display={`${Math.round(settings.shakeIntensity * 100)} %`}
          onChange={(percent) => update({ shakeIntensity: percent / 100 })}
        />
      </OptionSection>

      <ButtonRow className={styles.reset}>
        <Button onClick={() => setSettings(resetGraphicsSettings())}>
          {`↺ RÉINITIALISER L'AFFICHAGE (${defaults.fovBase}°, ${Math.round(defaults.shakeIntensity * 100)} %)`}
        </Button>
      </ButtonRow>
    </>
  );
}
