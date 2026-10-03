import {
  RECOIL_INTERPOLATION_VARIANTS,
  type WeaponConfig,
} from "../../../../../../game/player/weaponConfig";
import { TuningCheckbox } from "../../../controls/TuningCheckbox/TuningCheckbox";
import { TuningSlider } from "../../../controls/TuningSlider/TuningSlider";
import { TuningActions } from "../../../layout/TuningActions/TuningActions";
import { TuningGroup } from "../../../layout/TuningGroup/TuningGroup";
import { TuningNote } from "../../../layout/TuningNote/TuningNote";
import type { ConfigEditor } from "../../../lib/tuningTypes";
import { RECOIL_FIELDS, RECOIL_WEAPONS } from "./recoilFields";

interface RecoilTuningProps {
  weapon: ConfigEditor<WeaponConfig>;
}

// Compare les modes de présentation ; le pas fixe garde les mêmes impulsions.
export function RecoilTuning({ weapon }: RecoilTuningProps) {
  return (
    <TuningGroup title="Recul — comparaison de l’interpolation">
      <TuningCheckbox
        checked={weapon.values.recoilPositionInterpolated}
        onChange={(checked) => weapon.set("recoilPositionInterpolated", checked)}
      >
        Interpoler la position entre les pas fixes
      </TuningCheckbox>
      <TuningActions>
        {Object.entries(RECOIL_INTERPOLATION_VARIANTS).map(([name, variant]) => (
          <button
            key={name}
            type="button"
            aria-pressed={weapon.values.recoilPositionInterpolated === variant.recoilPositionInterpolated}
            onClick={() => weapon.set("recoilPositionInterpolated", variant.recoilPositionInterpolated)}
          >
            {name === "STABLE" ? "Stable — position interpolée" : "Historique — impulsion immédiate"}
          </button>
        ))}
      </TuningActions>
      <TuningNote>
        Enregistre 15 secondes de tirs avec F9. Arrête avec F9, puis rejoue avec F10
        dans chacun des deux modes. Garde les amplitudes identiques pour comparer.
      </TuningNote>
      {RECOIL_WEAPONS.map(({ key, label }) => (
        <TuningGroup key={key} title={label}>
          {RECOIL_FIELDS.map(({ key: fieldKey, ...field }) => (
            <TuningSlider
              key={fieldKey}
              {...field}
              value={weapon.values[key][fieldKey]}
              onChange={(value) => weapon.set(key, { ...weapon.values[key], [fieldKey]: value })}
            />
          ))}
        </TuningGroup>
      ))}
    </TuningGroup>
  );
}
