import type { TrainRideConfig } from "./trainRideTypes";

export const TRAIN_RIDE_VARIANTS = {
  COURT: { speed: 18, duration: 30, acceleration: 4, braking: 4 },
  REFERENCE: { speed: 24, duration: 60, acceleration: 6, braking: 6 },
  LONG: { speed: 28, duration: 90, acceleration: 8, braking: 8 },
} satisfies Record<string, Partial<TrainRideConfig>>;

export const trainRideConfig: TrainRideConfig = {
  ...TRAIN_RIDE_VARIANTS.REFERENCE,
  waveDelay: 12,
  combat: true,
};

export const RIDE_ENTRY_DOOR = "door_essai_rame_entree";
export const RIDE_EXIT_DOOR = "door_essai_rame_sortie";
