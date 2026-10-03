import { useState } from "react";

import { FEEL_VARIANTS, moveConfig } from "../../../../../game/player/movement/moveConfig";
import { createMovementTuning } from "../../../../../game/devtools/movementTuning";
import { applyFeelVariant } from "../../../../../game/devtools/replay/testHarness";
import { MOVE_GROUPS } from "../../lib/tuningFields";
import type { MoveField } from "../../lib/tuningTypes";
import { TuningActions } from "../../layout/TuningActions/TuningActions";
import { TuningCheckbox } from "../../controls/TuningCheckbox/TuningCheckbox";
import { TuningGroup } from "../../layout/TuningGroup/TuningGroup";
import { TuningNote } from "../../layout/TuningNote/TuningNote";
import { TuningSection } from "../../layout/TuningSection/TuningSection";
import { TuningSlider } from "../../controls/TuningSlider/TuningSlider";
import { useConfigEditor } from "../../lib/useConfigEditor";
import { VariantButtons } from "../../controls/VariantButtons/VariantButtons";

const VARIANT_NAMES = Object.keys(FEEL_VARIANTS) as (keyof typeof FEEL_VARIANTS)[];

export function MoveTuning() {
  const move = useConfigEditor(moveConfig);
  const [movement] = useState(createMovementTuning);

  function handleChange(field: MoveField, value: number) {
    move.set(field.key, value);
    if (field.requiresApplyConfig) movement.apply(false);
  }

  function handleCommit(field: MoveField) {
    if (field.requiresApplyConfig) movement.apply(true);
  }

  function handleReset() {
    movement.reset();
    move.refresh();
  }

  function handleVariant(name: keyof typeof FEEL_VARIANTS) {
    applyFeelVariant(name);
    move.refresh();
  }

  return (
    <TuningSection title="Tuning — moveConfig" hint="` pour fermer, puis clique dans le jeu pour reprendre la souris.">
      <TuningActions>
        <button type="button" onClick={handleReset}>
          Défauts
        </button>
        <VariantButtons names={VARIANT_NAMES} onApply={handleVariant} />
      </TuningActions>

      {MOVE_GROUPS.map((group) => (
        <TuningGroup key={group.title} title={group.title}>
          {group.fields.map((field) => (
            <TuningSlider
              key={field.key}
              label={field.label}
              unit={field.unit}
              decimals={field.decimals}
              min={field.min}
              max={field.max}
              step={field.step}
              value={move.values[field.key]}
              onChange={(value) => handleChange(field, value)}
              onCommit={() => handleCommit(field)}
            />
          ))}
        </TuningGroup>
      ))}

      <TuningCheckbox
        checked={move.values.autostepIncludeDynamicBodies}
        onChange={(checked) => {
          move.set("autostepIncludeDynamicBodies", checked);
          movement.apply(true);
        }}
      >
        Autostep sur corps dynamiques ⚙
      </TuningCheckbox>
      <TuningNote>⚙ = recalcul physique (applyConfig) appliqué automatiquement.</TuningNote>
    </TuningSection>
  );
}
