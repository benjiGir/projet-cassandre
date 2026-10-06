import { kickConfig, KICK_VARIANTS } from "../../../../../../game/player/weapons/kickConfig";
import { useConfigEditor } from "../../../lib/useConfigEditor";
import { TuningSlider } from "../../../controls/TuningSlider/TuningSlider";
import { TuningGroup } from "../../../layout/TuningGroup/TuningGroup";
import { TuningActions } from "../../../layout/TuningActions/TuningActions";
import { TuningNote } from "../../../layout/TuningNote/TuningNote";
import { KICK_FIELDS, KICK_VARIANT_LABELS } from "./kickFields";

// Réglages de développement ; la simulation lit sa propre config au pas fixe.
// see: docs/6-reference/notes-code-gameplay-joueur.md#coup-de-pied
export function KickTuning() {
  const kick = useConfigEditor(kickConfig);

  function applyVariant(name: keyof typeof KICK_VARIANTS): void {
    Object.assign(kickConfig, KICK_VARIANTS[name]);
    kick.refresh();
  }

  return (
    <TuningGroup title="Coup de pied — attaque de départ">
      <TuningActions>
        {(Object.keys(KICK_VARIANTS) as Array<keyof typeof KICK_VARIANTS>).map((name) => (
          <button key={name} type="button" onClick={() => applyVariant(name)}>
            {KICK_VARIANT_LABELS[name]}
          </button>
        ))}
      </TuningActions>
      {KICK_FIELDS.map(({ key, ...field }) => (
        <TuningSlider key={key} {...field} value={kick.values[key]} onChange={(value) => kick.set(key, value)} />
      ))}
      <TuningNote>
        Avant de ramasser une arme, enregistre 15 secondes de déplacements et de coups
        avec F9. Arrête avec F9, puis compare Vif, Franc et Lourd avec F10.
        Les variantes gardent la même portée et les mêmes dégâts.
      </TuningNote>
    </TuningGroup>
  );
}
