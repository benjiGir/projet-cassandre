import { CROSSHAIR_VARIANTS, type WeaponConfig } from "../../../../../../game/player/weaponConfig";
import { applyCrosshairVariant } from "../../../../../../game/devtools/testHarness";
import { FieldSliders } from "../../../controls/FieldSliders/FieldSliders";
import { CROSSHAIR_FIELDS } from "../../../lib/tuningFields";
import { TuningActions } from "../../../layout/TuningActions/TuningActions";
import { TuningCheckbox } from "../../../controls/TuningCheckbox/TuningCheckbox";
import { TuningGroup } from "../../../layout/TuningGroup/TuningGroup";
import type { ConfigEditor } from "../../../lib/useConfigEditor";
import { VariantButtons } from "../../../controls/VariantButtons/VariantButtons";

const VARIANT_NAMES = Object.keys(CROSSHAIR_VARIANTS) as (keyof typeof CROSSHAIR_VARIANTS)[];

const STYLES: ReadonlyArray<{ id: WeaponConfig["crosshairStyle"]; label: string }> = [
  { id: "cross", label: "Croix" },
  { id: "dot", label: "Point" },
];

export interface CrosshairTuningProps {
  weapon: ConfigEditor<WeaponConfig>;
}

/** Le réticule (retour playtest : « le tir est hasardeux, pas de repère de visée »). */
export function CrosshairTuning({ weapon }: CrosshairTuningProps) {
  return (
    <TuningGroup title="Réticule (retour playtest — tir hasardeux, pas de repère de visée)">
      <TuningCheckbox
        checked={weapon.values.crosshairEnabled}
        onChange={(checked) => weapon.set("crosshairEnabled", checked)}
      >
        Activé (position = correctitude, jamais une variante)
      </TuningCheckbox>
      <TuningActions>
        {STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            aria-pressed={weapon.values.crosshairStyle === style.id}
            onClick={() => weapon.set("crosshairStyle", style.id)}
          >
            {style.label}
          </button>
        ))}
      </TuningActions>
      <TuningCheckbox
        checked={weapon.values.crosshairPulseEnabled}
        onChange={(checked) => weapon.set("crosshairPulseEnabled", checked)}
      >
        Pulsation au tir
      </TuningCheckbox>
      <TuningActions>
        <VariantButtons
          names={VARIANT_NAMES}
          onApply={(name) => {
            applyCrosshairVariant(name);
            weapon.refresh();
          }}
        />
      </TuningActions>
      <FieldSliders editor={weapon} fields={CROSSHAIR_FIELDS} />
    </TuningGroup>
  );
}
