import { suitConfig } from "../../../../../../game/entities/suitConfig";
import { weaponConfig } from "../../../../../../game/player/weaponConfig";
import { CrosshairTuning } from "../CrosshairTuning/CrosshairTuning";
import { HitmarkerTuning } from "../HitmarkerTuning/HitmarkerTuning";
import { ImpactTuning } from "../ImpactTuning/ImpactTuning";
import { SuitTuning } from "../SuitTuning/SuitTuning";
import { TuningSection } from "../../../layout/TuningSection/TuningSection";
import { useConfigEditor } from "../../../lib/useConfigEditor";

/**
 * Harnais de feedback de hit. Un seul éditeur par config, partagé par les
 * groupes : « Défauts » dans le groupe Impact remet toute la config d'arme,
 * et les groupes Hitmarker et Réticule doivent se redessiner avec lui.
 */
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
      <HitmarkerTuning weapon={weapon} />
      <CrosshairTuning weapon={weapon} />
      <SuitTuning suit={suit} />
    </TuningSection>
  );
}
