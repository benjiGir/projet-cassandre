import { Howl } from "howler";

import { assetUrl } from "./assetPath";
import { waitForAudioLoad } from "./audioPreparation";
import { computeWaterAmbienceMix, smoothTowards, type Vec3Like, type WaterAmbienceMix } from "./waterAmbienceMix";

const SHOWER_AMBIENCE_PATH = assetUrl("assets/audio/sfx");
const PEAK_VOLUME = 0.3;
const GAIN_SMOOTH_TAU = 0.06;
const PAN_SMOOTH_TAU = 0.09;
const AUDIBLE_GAIN_EPSILON = 0.01;

let showerHowl: Howl | null = null;
let playbackId: number | null = null;
let loaded = false;
let currentGain = 0;
let currentPan = 0;
let preparation: Promise<void> | null = null;
let warnedMissing = false;

const targetMix: WaterAmbienceMix = { gain: 0, pan: 0 };
/** Gain du canal « ambiances » réglé par le joueur (`game/audioSettings.ts`). */
let channelGain = 1;

export function setShowerAmbienceGain(gain: number): void {
  channelGain = gain;
}

/** Décode et amorce la boucle en silence pendant le chargement. */
export function initShowerAmbience(): Promise<void> {
  if (preparation) return preparation;

  showerHowl = new Howl({
    src: [`${SHOWER_AMBIENCE_PATH}/amb_shower.ogg`, `${SHOWER_AMBIENCE_PATH}/amb_shower.m4a`],
    loop: true,
    html5: false,
    volume: 0,
    onload: () => {
      loaded = true;
      playbackId = showerHowl!.play();
      showerHowl!.stereo(0, playbackId);
    },
    onloaderror: () => {
      loaded = false;
      if (warnedMissing) return;
      warnedMissing = true;
      console.warn(`[audio] boucle de douche introuvable (${SHOWER_AMBIENCE_PATH}/amb_shower.{ogg,m4a}) — le jeu continue sans elle.`);
    },
  });
  preparation = waitForAudioLoad(showerHowl).then(() => {});
  return preparation;
}

/** Met à jour la boucle localisée depuis la présentation, jamais depuis le pas fixe. */
export function updateShowerAmbience(
  listenerPosition: Vec3Like,
  listenerRight: Vec3Like,
  showers: readonly Vec3Like[],
  dt: number,
  active: boolean,
): void {
  if (active) computeWaterAmbienceMix(listenerPosition, listenerRight, showers, targetMix);
  else {
    targetMix.gain = 0;
    targetMix.pan = 0;
  }

  currentGain = smoothTowards(currentGain, targetMix.gain, dt, GAIN_SMOOTH_TAU);
  currentPan = smoothTowards(currentPan, targetMix.pan, dt, PAN_SMOOTH_TAU);

  if (!showerHowl || !loaded) return;

  if (playbackId !== null) {
    showerHowl.volume(currentGain > AUDIBLE_GAIN_EPSILON ? currentGain * PEAK_VOLUME * channelGain : 0, playbackId);
    showerHowl.stereo(currentPan, playbackId);
  }
}
