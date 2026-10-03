import { HITMARKER_VARIANTS, type WeaponConfig } from "../../../../../../game/player/weapons/weaponConfig";
import { applyHitmarkerVariant } from "../../../../../../game/devtools/replay/testHarness";
import { FieldSliders } from "../../../controls/FieldSliders/FieldSliders";
import { HITMARKER_FIELDS } from "../../../lib/tuningFields";
import { TuningActions } from "../../../layout/TuningActions/TuningActions";
import { TuningCheckbox } from "../../../controls/TuningCheckbox/TuningCheckbox";
import { TuningGroup } from "../../../layout/TuningGroup/TuningGroup";
import type { ConfigEditor } from "../../../lib/tuningTypes";
import { VariantButtons } from "../../../controls/VariantButtons/VariantButtons";

const VARIANT_NAMES = Object.keys(HITMARKER_VARIANTS) as (keyof typeof HITMARKER_VARIANTS)[];

export interface HitmarkerTuningProps {
  weapon: ConfigEditor<WeaponConfig>;
}

export function HitmarkerTuning({ weapon }: HitmarkerTuningProps) {
  return (
    <TuningGroup title="Hitmarker (canal absent avant cette intervention)">
      <TuningCheckbox
        checked={weapon.values.hitmarkerEnabled}
        onChange={(checked) => weapon.set("hitmarkerEnabled", checked)}
      >
        Activé
      </TuningCheckbox>
      <TuningActions>
        <VariantButtons
          names={VARIANT_NAMES}
          onApply={(name) => {
            applyHitmarkerVariant(name);
            weapon.refresh();
          }}
        />
      </TuningActions>
      <FieldSliders editor={weapon} fields={HITMARKER_FIELDS} />
    </TuningGroup>
  );
}
