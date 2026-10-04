import { BOISSON_VARIANTS, perkConfig } from "../../../../../game/player/perkConfig";
import { applyBoissonVariant } from "../../../../../game/devtools/replay/testHarness";
import { TuningActions } from "../../layout/TuningActions/TuningActions";
import { TuningGroup } from "../../layout/TuningGroup/TuningGroup";
import { TuningNote } from "../../layout/TuningNote/TuningNote";
import { TuningSection } from "../../layout/TuningSection/TuningSection";
import { TuningSlider } from "../../controls/TuningSlider/TuningSlider";
import { useConfigEditor } from "../../lib/useConfigEditor";
import { VariantButtons } from "../../controls/VariantButtons/VariantButtons";

const VARIANT_NAMES = Object.keys(BOISSON_VARIANTS) as (keyof typeof BOISSON_VARIANTS)[];

// Harnais A/B de la pointe de vitesse du perk boisson : le déplacement est
// validé, c'est l'utilisateur qui tranche entre les variantes.
export function PerkTuning() {
  const perks = useConfigEditor(perkConfig);

  return (
    <TuningSection separated>
      <TuningGroup title="Perk boisson — pointe de vitesse après un kill">
        <TuningActions>
          <VariantButtons
            names={VARIANT_NAMES}
            label={(name) => `Boisson ${name}`}
            onApply={(name) => {
              applyBoissonVariant(name);
              perks.refresh();
            }}
          />
        </TuningActions>
        <TuningSlider
          label="Multiplicateur de vitesse"
          decimals={2}
          min={1}
          max={2}
          step={0.05}
          value={perks.values.boissonSpeedScale}
          onChange={(value) => perks.set("boissonSpeedScale", value)}
        />
        <TuningSlider
          label="Durée de la pointe"
          unit="s"
          decimals={1}
          min={0.5}
          max={5}
          step={0.1}
          value={perks.values.boissonDuration}
          onChange={(value) => perks.set("boissonDuration", value)}
        />
        <TuningNote>
          Pour l'avoir sans payer : cassandre.bornes.donner("boisson") dans la console, puis un vrai kill — ou
          cassandre.bornes.pointe(), qui lance la pointe sans ennemi.
        </TuningNote>
      </TuningGroup>
    </TuningSection>
  );
}
