import { trainRideConfig, TRAIN_RIDE_VARIANTS } from "../../../../../game/level/trainRide/trainRideConfig";
import { useConfigEditor } from "../../lib/useConfigEditor";
import { TuningSlider } from "../../controls/TuningSlider/TuningSlider";
import { TuningGroup } from "../../layout/TuningGroup/TuningGroup";
import { TuningActions } from "../../layout/TuningActions/TuningActions";
import { TuningNote } from "../../layout/TuningNote/TuningNote";
import { TRAIN_RIDE_FIELDS, TRAIN_RIDE_LABELS } from "./trainRideFields";

export function TrainRideTuning() {
  const config = useConfigEditor(trainRideConfig);
  if (!window.cassandre?.voyageRame.system) return null;
  function applyVariant(name: keyof typeof TRAIN_RIDE_VARIANTS): void {
    Object.assign(trainRideConfig, TRAIN_RIDE_VARIANTS[name]);
    window.cassandre.voyageRame.system?.enqueue("reset");
    config.refresh();
  }
  return (
    <TuningGroup title="T4 — Voyage à bord">
      <TuningActions>
        {(Object.keys(TRAIN_RIDE_VARIANTS) as Array<keyof typeof TRAIN_RIDE_VARIANTS>).map((name) => (
          <button key={name} type="button" onClick={() => applyVariant(name)}>{TRAIN_RIDE_LABELS[name]}</button>
        ))}
      </TuningActions>
      {TRAIN_RIDE_FIELDS.map(({ key, ...field }) => (
        <TuningSlider key={key} {...field} value={config.values[key]} onChange={(value) => config.set(key, value)} />
      ))}
      <TuningActions>
        <button type="button" aria-pressed={config.values.combat} onClick={() => config.set("combat", !config.values.combat)}>Embuscade</button>
        <button type="button" onClick={() => window.cassandre.voyageRame.system?.enqueue("depart")}>Partir</button>
        <button type="button" onClick={() => window.cassandre.voyageRame.system?.enqueue("reset")}>Repartir à zéro</button>
      </TuningActions>
      <TuningNote>
        E devant le pupitre de cabine. Sortie droite à l'arrivée.
        Les réglages sont retenus au départ. Compare les trois durées depuis la rame.
        F9/F10 remet le voyage à zéro ; sans combat, utilise le même départ au pupitre.
        La vague apparaît une seule fois par partie ; reconnecter pour la rejouer.
      </TuningNote>
    </TuningGroup>
  );
}
