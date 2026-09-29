import { Howl } from "howler";

import { assetUrl } from "./assetPath";
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
let isPlaying = false;
let warnedMissing = false;

const targetMix: WaterAmbienceMix = { gain: 0, pan: 0 };

/** Précharge une boucle dédiée à la douche, sans bloquer le démarrage du jeu. */
export function initShowerAmbience(): void {
  if (showerHowl) return;

  showerHowl = new Howl({
    src: [`${SHOWER_AMBIENCE_PATH}/amb_shower.ogg`, `${SHOWER_AMBIENCE_PATH}/amb_shower.m4a`],
    loop: true,
    html5: false,
    volume: 0,
    onload: () => {
      loaded = true;
    },
    onloaderror: () => {
      loaded = false;
      if (warnedMissing) return;
      warnedMissing = true;
      console.warn(`[audio] boucle de douche introuvable (${SHOWER_AMBIENCE_PATH}/amb_shower.{ogg,m4a}) — le jeu continue sans elle.`);
    },
  });
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

  const audible = currentGain > AUDIBLE_GAIN_EPSILON;
  if (audible && !isPlaying) {
    try {
      playbackId = showerHowl.play();
      isPlaying = true;
    } catch {
      playbackId = null;
    }
  } else if (!audible && isPlaying) {
    showerHowl.stop(playbackId ?? undefined);
    playbackId = null;
    isPlaying = false;
  }

  if (isPlaying && playbackId !== null) {
    showerHowl.volume(currentGain * PEAK_VOLUME, playbackId);
    showerHowl.stereo(currentPan, playbackId);
  }
}
