import { useRef } from "react";

import { FEEL_VARIANTS, moveConfig, type MoveConfig } from "../../../../../game/player/moveConfig";
import { applyFeelVariant } from "../../../../../game/devtools/testHarness";
import { MOVE_GROUPS, type MoveField } from "../../lib/tuningFields";
import { TuningActions } from "../../layout/TuningActions/TuningActions";
import { TuningCheckbox } from "../../controls/TuningCheckbox/TuningCheckbox";
import { TuningGroup } from "../../layout/TuningGroup/TuningGroup";
import { TuningNote } from "../../layout/TuningNote/TuningNote";
import { TuningSection } from "../../layout/TuningSection/TuningSection";
import { TuningSlider } from "../../controls/TuningSlider/TuningSlider";
import { useConfigEditor } from "../../lib/useConfigEditor";
import { VariantButtons } from "../../controls/VariantButtons/VariantButtons";

// Figé à l'IMPORT, avant que `main()` ou un réglage persisté ne mute la config :
// c'est la seule référence fiable pour « Défauts ».
const DEFAULT_MOVE_CONFIG: MoveConfig = { ...moveConfig };

const VARIANT_NAMES = Object.keys(FEEL_VARIANTS) as (keyof typeof FEEL_VARIANTS)[];

// Recréer la capsule Rapier et le KCC à la cadence d'un trackpad (> 60 Hz) est
// coûteux : pendant un glissement on applique au plus toutes les 100 ms, puis
// une dernière fois, forcée, au relâchement.
const APPLY_CONFIG_THROTTLE_MS = 100;

/** Harnais de déplacement : les curseurs de `moveConfig`. */
export function MoveTuning() {
  const move = useConfigEditor(moveConfig);
  const lastApplyAt = useRef(0);

  function applyConfig(force: boolean) {
    const player = window.cassandre?.player;
    if (!player) return;
    const now = performance.now();
    if (!force && now - lastApplyAt.current < APPLY_CONFIG_THROTTLE_MS) return;
    lastApplyAt.current = now;
    player.applyConfig();
  }

  function handleChange(field: MoveField, value: number) {
    move.set(field.key, value);
    if (field.requiresApplyConfig) applyConfig(false);
  }

  function handleCommit(field: MoveField) {
    if (field.requiresApplyConfig) applyConfig(true);
  }

  function handleReset() {
    Object.assign(moveConfig, DEFAULT_MOVE_CONFIG);
    move.refresh();
    applyConfig(true);
  }

  // Les variantes ne touchent que la vue, jamais la capsule : pas d'applyConfig.
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
          applyConfig(true);
        }}
      >
        Autostep sur corps dynamiques ⚙
      </TuningCheckbox>
      <TuningNote>⚙ = recalcul physique (applyConfig) appliqué automatiquement.</TuningNote>
    </TuningSection>
  );
}
