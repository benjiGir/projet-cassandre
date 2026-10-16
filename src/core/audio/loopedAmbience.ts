import type { PromiseVoice } from "fx-audio/promise";

import { assetUrl } from "../loading/assetPath";
import { audioEngine, clampVolume, loadFirstSound } from "./audioEngine";
import { computeWaterAmbienceMix, smoothTowards, type Vec3Like, type WaterAmbienceMix } from "./waterAmbienceMix";

// Une boucle d'ambiance spatialisée : elle joue en continu, muette, et son
// volume comme son panoramique suivent les sources proches de l'auditeur.
// Un son décodé (Web Audio), pas un flux HTML5 : le panoramique et les raccords de boucle y sont fiables.
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
  let playback: PromiseVoice | null = null;
  let audible = false;
  let preparation: Promise<void> | null = null;
  let channelGain = 1;
  let currentGain = 0;
  let currentPan = 0;

  return {
    init() {
      if (preparation) return preparation;
      preparation = loadFirstSound([`${path}.ogg`, `${path}.m4a`]).then((sound) => {
        if (!sound) {
          console.warn(`[audio] ${label} introuvable (${path}.{ogg,m4a}) — le jeu continue sans elle.`);
          return;
        }
        playback = audioEngine().play(sound, { loop: true, volume: 0, pan: 0 });
      });
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

      if (!playback) return;

      audible = currentGain > AUDIBLE_GAIN_EPSILON;
      playback.setVolume(audible ? clampVolume(currentGain * peakVolume * channelGain) : 0);
      playback.setPan(Math.max(-1, Math.min(1, currentPan)));
    },
    debugState() {
      return {
        charge: playback !== null,
        joue: audible,
        volume: currentGain * peakVolume * channelGain,
        pan: currentPan,
      };
    },
  };
}
