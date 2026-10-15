import { createLoopedAmbience } from "./loopedAmbience";

/** La boucle des douches en marche. */
const shower = createLoopedAmbience({
  file: "amb_shower",
  label: "boucle de douche",
  peakVolume: 0.3,
  gainSmoothTau: 0.06,
});

export const initShowerAmbience = shower.init;
export const setShowerAmbienceGain = shower.setGain;
export const updateShowerAmbience = shower.update;
