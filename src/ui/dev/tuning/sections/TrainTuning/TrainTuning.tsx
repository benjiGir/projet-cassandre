import { trainConfig, TRAIN_VARIANTS } from "../../../../../game/level/trains/trainConfig";
import { useConfigEditor } from "../../lib/useConfigEditor";
import { TuningSlider } from "../../controls/TuningSlider/TuningSlider";
import { TuningGroup } from "../../layout/TuningGroup/TuningGroup";
import { TuningActions } from "../../layout/TuningActions/TuningActions";
import { TuningNote } from "../../layout/TuningNote/TuningNote";
import { TRAIN_FIELDS, TRAIN_VARIANT_LABELS } from "./trainFields";

// Éditeur de développement ; les commandes sont consommées par le pas fixe.
// see: docs/4-technique/prototype-trains.md#comment-vérifier
export function TrainTuning() {
  const config = useConfigEditor(trainConfig);
  if (!window.cassandre?.trains.system) return null;
  function applyVariant(name: keyof typeof TRAIN_VARIANTS): void {
    Object.assign(trainConfig, TRAIN_VARIANTS[name]);
    window.cassandre.trains.system?.enqueue({ type: "reset" });
    config.refresh();
  }
  return (
    <TuningGroup title="T1 — Trains du métro">
      <TuningActions>
        {(Object.keys(TRAIN_VARIANTS) as Array<keyof typeof TRAIN_VARIANTS>).map((name) => (
          <button key={name} type="button" onClick={() => applyVariant(name)}>
            {TRAIN_VARIANT_LABELS[name]}
          </button>
        ))}
      </TuningActions>
      {TRAIN_FIELDS.map(({ key, ...field }) => (
        <TuningSlider key={key} {...field} value={config.values[key]} onChange={(value) => config.set(key, value)} />
      ))}
      <TuningActions>
        <button
          type="button"
          aria-pressed={config.values.visualWarning}
          onClick={() => config.set("visualWarning", !config.values.visualWarning)}
        >
          Signal visuel
        </button>
        <button
          type="button"
          aria-pressed={config.values.soundWarning}
          onClick={() => config.set("soundWarning", !config.values.soundWarning)}
        >
          Signal sonore
        </button>
        <button type="button" onClick={() => window.cassandre.trains.system?.enqueue({ type: "reset" })}>
          Repartir à zéro
        </button>
      </TuningActions>
      <TuningNote>
        Boîtier rouge : arrêt. Levier bleu : aiguillage. E à proximité. F9 remet l'horaire à zéro et enregistre ; F10
        repart du même horaire. Compare les variantes sur 15 s de parcours sans combat (F8). L'alerte sonore est
        provisoire ; le son des rames arrive au lot T3.
      </TuningNote>
    </TuningGroup>
  );
}
