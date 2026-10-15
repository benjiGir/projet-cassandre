import type { Difficulty } from "../../session/progression/difficulty";
import { TRAIN_VARIANTS } from "./trainConfig";
import type { TrainConfig } from "./trainTypes";

export function trainDifficulty(difficulty: Difficulty): TrainConfig {
  const variant =
    difficulty === "client"
      ? TRAIN_VARIANTS.APPRENDRE
      : difficulty === "lanceur"
        ? TRAIN_VARIANTS.PRESSION
        : TRAIN_VARIANTS.TENSION;
  return { ...variant, visualWarning: true, soundWarning: true };
}
