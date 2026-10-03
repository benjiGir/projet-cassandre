import { Howl } from "howler";

import { assetUrl } from "../loading/assetPath";
import { waitForAudioLoad } from "./audioPreparation";
import { computeWaterAmbienceMix, smoothTowards, type Vec3Like, type WaterAmbienceMix } from "./waterAmbienceMix";

// Web Audio requis : le panoramique et les raccords ne sont pas fiables en HTML5.
// see: docs/6-reference/notes-code-core.md#mixage-de-leau

const WATER_AMBIENCE_BASE_PATH = assetUrl("assets/audio/sfx");

const PEAK_VOLUME = 0.35;

let channelGain = 1;

export function setWaterAmbienceGain(gain: number): void {
  channelGain = gain;
}

const GAIN_SMOOTH_TAU = 0.05;
const PAN_SMOOTH_TAU = 0.09;

const AUDIBLE_GAIN_EPSILON = 0.01;

let waterHowl: Howl | null = null;
let playbackId: number | null = null;
let loaded = false;
let warnedMissing = false;
let isPlaying = false;
let preparation: Promise<void> | null = null;
let currentGain = 0;
let currentPan = 0;

const targetMixScratch: WaterAmbienceMix = { gain: 0, pan: 0 };

export function initWaterAmbience(): Promise<void> {
  if (preparation) return preparation;

  waterHowl = new Howl({
    src: [`${WATER_AMBIENCE_BASE_PATH}/amb_water_jet.ogg`, `${WATER_AMBIENCE_BASE_PATH}/amb_water_jet.m4a`],
    loop: true,
    html5: false,
    volume: 0,
    onload: () => {
      loaded = true;
      playbackId = waterHowl!.play();
      waterHowl!.stereo(0, playbackId);
    },
    onloaderror: () => {
      if (warnedMissing) return;
      warnedMissing = true;
      console.warn(
        `[audio] boucle d'eau introuvable (${WATER_AMBIENCE_BASE_PATH}/amb_water_jet.{ogg,m4a}) — le jeu continue sans elle.`,
      );
    },
  });
  preparation = waitForAudioLoad(waterHowl).then(() => {});
  return preparation;
}

export function waterAmbienceDebugState(): { charge: boolean; joue: boolean; volume: number; pan: number } {
  return { charge: loaded, joue: isPlaying, volume: currentGain * PEAK_VOLUME * channelGain, pan: currentPan };
}

export function updateWaterAmbience(
  listenerPosition: Vec3Like,
  listenerRight: Vec3Like,
  jets: readonly Vec3Like[],
  dt: number,
  active: boolean,
): void {
  if (active) computeWaterAmbienceMix(listenerPosition, listenerRight, jets, targetMixScratch);
  else {
    targetMixScratch.gain = 0;
    targetMixScratch.pan = 0;
  }
  currentGain = smoothTowards(currentGain, targetMixScratch.gain, dt, GAIN_SMOOTH_TAU);
  currentPan = smoothTowards(currentPan, targetMixScratch.pan, dt, PAN_SMOOTH_TAU);

  if (!waterHowl || !loaded || playbackId === null) return;

  const audible = currentGain > AUDIBLE_GAIN_EPSILON;
  isPlaying = audible;
  waterHowl.volume(audible ? currentGain * PEAK_VOLUME * channelGain : 0, playbackId);
  waterHowl.stereo(currentPan, playbackId);
}
