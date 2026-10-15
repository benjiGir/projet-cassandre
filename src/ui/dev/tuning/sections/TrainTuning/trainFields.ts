import type { TrainConfig } from "../../../../../game/level/trains/trainTypes";
import type { TuningSliderProps } from "../../controls/TuningSlider/TuningSlider";

export const TRAIN_FIELDS = [
  { key: "speed", label: "Vitesse des rames", min: 18, max: 30, step: 1, decimals: 0, unit: "m/s" },
  { key: "warning", label: "Préavis", min: 4, max: 7, step: 1, decimals: 0, unit: "s" },
  { key: "interval", label: "Intervalle", min: 20, max: 30, step: 1, decimals: 0, unit: "s" },
  { key: "stopDuration", label: "Durée de l'arrêt", min: 5, max: 12, step: 1, decimals: 0, unit: "s" },
  { key: "stopCooldown", label: "Délai commun avant réemploi", min: 0, max: 40, step: 1, decimals: 0, unit: "s" },
] satisfies Array<
  Omit<TuningSliderProps, "value" | "onChange"> & {
    key: { [K in keyof TrainConfig]: TrainConfig[K] extends number ? K : never }[keyof TrainConfig];
  }
>;

export const TRAIN_VARIANT_LABELS = {
  APPRENDRE: "Apprendre — lent, annoncé tôt",
  TENSION: "Tension — rythme soutenu",
  PRESSION: "Pression — rapide, préavis court",
};
