import { Howl } from "howler";

import { assetUrl } from "../loading/assetPath";
import { waitForAudioLoad } from "./audioPreparation";
import { computeWaterAmbienceMix, smoothTowards, type Vec3Like, type WaterAmbienceMix } from "./waterAmbienceMix";

// Une boucle d'ambiance spatialisée : elle joue en continu, muette, et son
// volume comme son panoramique suivent les sources proches de l'auditeur.
// Web Audio requis : le panoramique et les raccords ne sont pas fiables en HTML5.
// see: docs/6-reference/notes-code-core.md#mixage-de-leau

const AMBIENCE_BASE_PATH = assetUrl("assets/audio/sfx");
const PAN_SMOOTH_TAU = 0.09;
const AUDIBLE_GAIN_EPSILON = 0.01;

export interface LoopedAmbienceConfig {
  /** Nom du fichier sous `assets/audio/sfx`, sans extension. */
  readonly file: string;
  /** Ce qui manque, dans l'avertissement d'un fichier introuvable (« boucle d'eau »). */
  readonly label: string;
  /** Volume de la boucle quand l'auditeur est sur une source. */
  readonly peakVolume: number;
  /** Constante de temps du lissage du gain, en secondes. */
  readonly gainSmoothTau: number;
}

// Des fonctions, pas des méthodes : aucune ne lit `this`, on peut les exporter une à une.
export interface LoopedAmbience {
  readonly init: () => Promise<void>;
  /** Gain du canal « ambiances » des réglages audio. */
  readonly setGain: (gain: number) => void;
  /** Une fois par image. `active` faux : la boucle retombe au silence (pause, menus). */
  readonly update: (
    listenerPosition: Vec3Like,
    listenerRight: Vec3Like,
    sources: readonly Vec3Like[],
    dt: number,
    active: boolean,
  ) => void;
  readonly debugState: () => { charge: boolean; joue: boolean; volume: number; pan: number };
}

export function createLoopedAmbience({ file, label, peakVolume, gainSmoothTau }: LoopedAmbienceConfig): LoopedAmbience {
  const path = `${AMBIENCE_BASE_PATH}/${file}`;
  const targetMix: WaterAmbienceMix = { gain: 0, pan: 0 };
  let howl: Howl | null = null;
  let playbackId: number | null = null;
  let loaded = false;
  let warnedMissing = false;
  let audible = false;
  let preparation: Promise<void> | null = null;
  let channelGain = 1;
  let currentGain = 0;
  let currentPan = 0;

  return {
    init() {
      if (preparation) return preparation;
      const loop = new Howl({
        src: [`${path}.ogg`, `${path}.m4a`],
        loop: true,
        html5: false,
        volume: 0,
        onload: () => {
          loaded = true;
          playbackId = loop.play();
          loop.stereo(0, playbackId);
        },
        onloaderror: () => {
          if (warnedMissing) return;
          warnedMissing = true;
          console.warn(`[audio] ${label} introuvable (${path}.{ogg,m4a}) — le jeu continue sans elle.`);
        },
      });
      howl = loop;
      preparation = waitForAudioLoad(loop).then(() => {});
      return preparation;
    },
    setGain(gain) {
      channelGain = gain;
    },
    update(listenerPosition, listenerRight, sources, dt, active) {
      if (active) computeWaterAmbienceMix(listenerPosition, listenerRight, sources, targetMix);
      else {
        targetMix.gain = 0;
        targetMix.pan = 0;
      }
      currentGain = smoothTowards(currentGain, targetMix.gain, dt, gainSmoothTau);
      currentPan = smoothTowards(currentPan, targetMix.pan, dt, PAN_SMOOTH_TAU);

      if (!howl || !loaded || playbackId === null || !howl.playing(playbackId)) return;

      audible = currentGain > AUDIBLE_GAIN_EPSILON;
      howl.volume(audible ? currentGain * peakVolume * channelGain : 0, playbackId);
      howl.stereo(currentPan, playbackId);
    },
    debugState() {
      return { charge: loaded, joue: audible, volume: currentGain * peakVolume * channelGain, pan: currentPan };
    },
  };
}
