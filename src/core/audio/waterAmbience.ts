import { createLoopedAmbience } from "./loopedAmbience";

/** La boucle des jets d'eau (sanitaires cassés, fontaine). */
const water = createLoopedAmbience({
  file: "amb_water_jet",
  label: "boucle d'eau",
  peakVolume: 0.35,
  gainSmoothTau: 0.05,
});

export const initWaterAmbience = water.init;
export const setWaterAmbienceGain = water.setGain;
export const updateWaterAmbience = water.update;
export const waterAmbienceDebugState = water.debugState;
