import { FLASH_VARIANTS, KNOCKBACK_VARIANTS, suitConfig, type SuitConfig } from "../../../../../../game/entities/suitConfig";
import { applyFlashVariant, applyKnockbackVariant } from "../../../../../../game/devtools/testHarness";
import { FieldSliders } from "../../../controls/FieldSliders/FieldSliders";
import { SUIT_FEEDBACK_FIELDS } from "../../../lib/tuningFields";
import { TuningActions } from "../../../layout/TuningActions/TuningActions";
import { TuningGroup } from "../../../layout/TuningGroup/TuningGroup";
import type { ConfigEditor } from "../../../lib/useConfigEditor";
import { VariantButtons } from "../../../controls/VariantButtons/VariantButtons";

const DEFAULT_SUIT_CONFIG: SuitConfig = { ...suitConfig };

const KNOCKBACK_NAMES = Object.keys(KNOCKBACK_VARIANTS) as (keyof typeof KNOCKBACK_VARIANTS)[];
const FLASH_NAMES = Object.keys(FLASH_VARIANTS) as (keyof typeof FLASH_VARIANTS)[];

export interface SuitTuningProps {
  suit: ConfigEditor<SuitConfig>;
}

/** Ce que ressent un Costard touché : recul et flash de dégât. */
export function SuitTuning({ suit }: SuitTuningProps) {
  function handleReset() {
    Object.assign(suitConfig, DEFAULT_SUIT_CONFIG);
    suit.refresh();
  }

  return (
    <TuningGroup title="Costard — knockback & flash de dégât">
      <TuningActions>
        <button type="button" onClick={handleReset}>
          Défauts
        </button>
        <VariantButtons
          names={KNOCKBACK_NAMES}
          label={(name) => `Knockback ${name}`}
          onApply={(name) => {
            applyKnockbackVariant(name);
            suit.refresh();
          }}
        />
        <VariantButtons
          names={FLASH_NAMES}
          label={(name) => `Flash ${name}`}
          onApply={(name) => {
            applyFlashVariant(name);
            suit.refresh();
          }}
        />
      </TuningActions>
      <FieldSliders editor={suit} fields={SUIT_FEEDBACK_FIELDS} />
    </TuningGroup>
  );
}
