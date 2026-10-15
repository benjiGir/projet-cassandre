import { weaponConfig } from "../../../../../game/player/weapons/weaponConfig";
import { applyWeaponBalanceVariant } from "../../../../../game/devtools/replay/testHarness";
import { FieldSliders } from "../../controls/FieldSliders/FieldSliders";
import { VariantButtons } from "../../controls/VariantButtons/VariantButtons";
import { TuningActions } from "../../layout/TuningActions/TuningActions";
import { TuningGroup } from "../../layout/TuningGroup/TuningGroup";
import { TuningNote } from "../../layout/TuningNote/TuningNote";
import { TuningSection } from "../../layout/TuningSection/TuningSection";
import { useConfigEditor } from "../../lib/useConfigEditor";
import {
  BALANCE_VARIANT_LABELS,
  BALANCE_VARIANT_NAMES,
  MELEE_BALANCE_FIELDS,
  PISTOL_BALANCE_FIELDS,
} from "./weaponBalanceFields";

// Édite la config de développement ; les attaques restent dans le pas fixe.
// see: docs/6-reference/valeurs-armes.md#comparaison-des-réglages
export function WeaponBalanceTuning() {
  const weapon = useConfigEditor(weaponConfig);

  return (
    <TuningSection separated title="Équilibrage — pied-de-biche / pistolet" hint="Révisé est le réglage à essayer.">
      <TuningActions>
        <VariantButtons
          names={BALANCE_VARIANT_NAMES}
          label={(name) => BALANCE_VARIANT_LABELS[name]}
          onApply={(name) => {
            applyWeaponBalanceVariant(name);
            weapon.refresh();
          }}
        />
      </TuningActions>
      <TuningGroup title="Pied-de-biche">
        <FieldSliders editor={weapon} fields={MELEE_BALANCE_FIELDS} />
      </TuningGroup>
      <TuningGroup title="Pistolet">
        <FieldSliders editor={weapon} fields={PISTOL_BALANCE_FIELDS} />
      </TuningGroup>
      <TuningNote>
        F9 enregistre 15 secondes de déplacements et de tirs ; F9 arrête, F10 rejoue. Avant chaque comparaison, repars
        avec les mêmes armes, munitions et cibles neuves : le rejeu ne restaure que le joueur.
      </TuningNote>
    </TuningSection>
  );
}
