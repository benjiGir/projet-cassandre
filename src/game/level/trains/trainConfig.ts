import type { TrainConfig } from "./trainTypes";

export const TRAIN_VARIANTS = {
  APPRENDRE: { speed: 18, warning: 7, interval: 30, stopDuration: 12, stopCooldown: 30 },
  TENSION: { speed: 24, warning: 5, interval: 20, stopDuration: 8, stopCooldown: 30 },
  PRESSION: { speed: 30, warning: 4, interval: 20, stopDuration: 5, stopCooldown: 30 },
} satisfies Record<string, Partial<TrainConfig>>;

export const trainConfig: TrainConfig = {
  ...TRAIN_VARIANTS.TENSION,
  visualWarning: true,
  soundWarning: true,
};

export const TRAIN_WIDTH = 2.8;
export const TRAIN_HEIGHT = 3.2;
/** Pas d'une voiture le long de la rame, jeu d'attelage compris. */
export const TRAIN_CAR_LENGTH = 15;
/** Jeu entre deux voitures : la caisse, son collider et son volume mortel sont plus courts d'autant. */
const TRAIN_CAR_GAP = 0.35;
export const TRAIN_CAR_BODY_LENGTH = TRAIN_CAR_LENGTH - TRAIN_CAR_GAP;
export const TRAIN_CAR_COUNT = 3;
