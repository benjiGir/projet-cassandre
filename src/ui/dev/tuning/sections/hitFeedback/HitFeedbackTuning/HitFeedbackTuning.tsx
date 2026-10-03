import { suitConfig } from "../../../../../../game/entities/suit/suitConfig";
import { weaponConfig } from "../../../../../../game/player/weapons/weaponConfig";
import { CrosshairTuning } from "../CrosshairTuning/CrosshairTuning";
import { HitmarkerTuning } from "../HitmarkerTuning/HitmarkerTuning";
import { ImpactTuning } from "../ImpactTuning/ImpactTuning";
import { SuitTuning } from "../SuitTuning/SuitTuning";
import { RecoilTuning } from "../RecoilTuning/RecoilTuning";
import { TuningSection } from "../../../layout/TuningSection/TuningSection";
import { useConfigEditor } from "../../../lib/useConfigEditor";

export function HitFeedbackTuning() {
  const weapon = useConfigEditor(weaponConfig);
  const suit = useConfigEditor(suitConfig);

  return (
    <TuningSection
      separated
      title="Tuning — feedback de hit (Phase 3)"
      hint={'Retour playtest : "le feedback est mauvais sur un hit". Harnais A/B — aucune valeur ici n\'est un choix tranché.'}
    >
      <ImpactTuning weapon={weapon} />
      <RecoilTuning weapon={weapon} />
      <HitmarkerTuning weapon={weapon} />
      <CrosshairTuning weapon={weapon} />
      <SuitTuning suit={suit} />
    </TuningSection>
  );
}
