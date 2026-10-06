import type { TrainRideConfig } from "../../../../../game/level/trainRide/trainRideTypes";
import type { TuningSliderProps } from "../../controls/TuningSlider/TuningSlider";

export const TRAIN_RIDE_FIELDS = [
  { key: "speed", label: "Vitesse du tunnel", min: 12, max: 30, step: 1, decimals: 0, unit: "m/s" },
  { key: "duration", label: "Durée du voyage", min: 30, max: 90, step: 5, decimals: 0, unit: "s" },
  { key: "acceleration", label: "Accélération", min: 2, max: 12, step: 1, decimals: 0, unit: "s" },
  { key: "braking", label: "Freinage", min: 2, max: 12, step: 1, decimals: 0, unit: "s" },
  { key: "waveDelay", label: "Début de l'embuscade", min: 5, max: 25, step: 1, decimals: 0, unit: "s" },
] satisfies Array<Omit<TuningSliderProps, "value" | "onChange"> & { key: { [K in keyof TrainRideConfig]: TrainRideConfig[K] extends number ? K : never }[keyof TrainRideConfig] }>;

export const TRAIN_RIDE_LABELS = { COURT: "Court — 30 s", REFERENCE: "Référence — 60 s", LONG: "Long — 90 s" };
