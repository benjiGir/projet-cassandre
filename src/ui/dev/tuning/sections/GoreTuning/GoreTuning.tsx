import { goreConfig } from "../../../../../render/fx/goreConfig";
import { applyGoreVariant } from "../../../../../game/devtools/goreTuning";
import { FieldSliders } from "../../controls/FieldSliders/FieldSliders";
import { VariantButtons } from "../../controls/VariantButtons/VariantButtons";
import { TuningActions } from "../../layout/TuningActions/TuningActions";
import { TuningNote } from "../../layout/TuningNote/TuningNote";
import { TuningSection } from "../../layout/TuningSection/TuningSection";
import { useConfigEditor } from "../../lib/useConfigEditor";
import { GORE_FIELDS, GORE_VARIANT_LABELS, GORE_VARIANT_NAMES } from "./goreFields";

// Les profils modifient uniquement la présentation, jamais les dégâts.
// see: docs/4-technique/rendu.md#gore
export function GoreTuning() {
  const gore = useConfigEditor(goreConfig);

  return (
    <TuningSection separated title="Gore — éclatement" hint="Renforcé ajoute quatre morceaux et deux giclées.">
      <TuningActions>
        <VariantButtons
          names={GORE_VARIANT_NAMES}
          label={(name) => GORE_VARIANT_LABELS[name]}
          onApply={(name) => {
            applyGoreVariant(name);
            gore.refresh();
          }}
        />
      </TuningActions>
      <FieldSliders editor={gore} fields={GORE_FIELDS} />
      <TuningNote>
        Compare les profils sur des cibles neuves avec F9/F10. Le rejeu restaure uniquement le joueur : remets les
        corps, bonbonnes et munitions dans le même état avant chaque essai.
      </TuningNote>
    </TuningSection>
  );
}
