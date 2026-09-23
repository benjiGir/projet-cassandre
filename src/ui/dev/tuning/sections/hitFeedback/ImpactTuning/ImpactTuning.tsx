import { weaponConfig, IMPACT_VARIANTS, type WeaponConfig } from "../../../../../../game/player/weaponConfig";
import { applyImpactVariant } from "../../../../../../game/devtools/testHarness";
import { FieldSliders } from "../../../controls/FieldSliders/FieldSliders";
import { IMPACT_FIELDS } from "../../../lib/tuningFields";
import { TuningActions } from "../../../layout/TuningActions/TuningActions";
import { TuningGroup } from "../../../layout/TuningGroup/TuningGroup";
import type { ConfigEditor } from "../../../lib/useConfigEditor";
import { VariantButtons } from "../../../controls/VariantButtons/VariantButtons";

// Figé à l'import, avant toute mutation : la référence de « Défauts ».
const DEFAULT_WEAPON_CONFIG: WeaponConfig = { ...weaponConfig };

const VARIANT_NAMES = Object.keys(IMPACT_VARIANTS) as (keyof typeof IMPACT_VARIANTS)[];

export interface ImpactTuningProps {
  weapon: ConfigEditor<WeaponConfig>;
}

/** Hitstop et secousse, mur contre ennemi. « Défauts » remet TOUTE la config d'arme. */
export function ImpactTuning({ weapon }: ImpactTuningProps) {
  function handleReset() {
    Object.assign(weaponConfig, DEFAULT_WEAPON_CONFIG);
    weapon.refresh();
  }

  return (
    <TuningGroup title="Impact — hitstop / shake (mur vs ennemi)">
      <TuningActions>
        <button type="button" onClick={handleReset}>
          Défauts
        </button>
        <VariantButtons
          names={VARIANT_NAMES}
          onApply={(name) => {
            applyImpactVariant(name);
            weapon.refresh();
          }}
        />
      </TuningActions>
      <FieldSliders editor={weapon} fields={IMPACT_FIELDS} />
    </TuningGroup>
  );
}
