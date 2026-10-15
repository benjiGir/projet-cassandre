import { propDebrisConfig } from "../../../../../render/fx/propDebris/propDebrisConfig";
import { applyPropDebrisVariant } from "../../../../../game/devtools/propDebrisTuning";
import { FieldSliders } from "../../controls/FieldSliders/FieldSliders";
import { VariantButtons } from "../../controls/VariantButtons/VariantButtons";
import { TuningActions } from "../../layout/TuningActions/TuningActions";
import { TuningNote } from "../../layout/TuningNote/TuningNote";
import { TuningSection } from "../../layout/TuningSection/TuningSection";
import { useConfigEditor } from "../../lib/useConfigEditor";
import { PROP_DEBRIS_FIELDS, PROP_DEBRIS_VARIANT_LABELS, PROP_DEBRIS_VARIANT_NAMES } from "./propDebrisFields";

// La présentation seule est réglée ici ; les dégâts restent ceux du jeu.
// see: docs/4-technique/rendu.md#débris-de-carton-et-de-bois
export function PropDebrisTuning() {
  const fragments = useConfigEditor(propDebrisConfig);
  return (
    <TuningSection separated title="Casse — carton et bois" hint="Sobre garde les morceaux près de l’objet.">
      <TuningActions>
        <VariantButtons
          names={PROP_DEBRIS_VARIANT_NAMES}
          label={(name) => PROP_DEBRIS_VARIANT_LABELS[name]}
          onApply={(name) => {
            applyPropDebrisVariant(name);
            fragments.refresh();
          }}
        />
      </TuningActions>
      <FieldSliders editor={fragments} fields={PROP_DEBRIS_FIELDS} />
      <TuningNote>
        Compare sur des objets neufs. F9/F10 enregistre et rejoue les gestes ; recharge le niveau avant chaque essai
        pour restaurer les objets.
      </TuningNote>
    </TuningSection>
  );
}
