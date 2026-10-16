import type { PromiseVoice } from "fx-audio/promise";
import type { SpriteSheet } from "fx-audio";

import { decodeAudioSpriteManifest } from "./audioManifest";
import { assetUrl } from "../loading/assetPath";
import { audioEngine, clampVolume, createdAudioEngine, loadFirstSound, spriteSheet } from "./audioEngine";
import { fetchJson } from "../net/fetchJson";

// see: docs/6-reference/notes-code-core.md#adaptateurs-audio

const VOICE_BASE_PATH = assetUrl("assets/audio/voix");
const VOICE_VOLUME = 1.0;

let atlas: SpriteSheet | null = null;
let durations = new Map<string, number>();
let lectureEnCours: PromiseVoice | null = null;
let loading: Promise<void> | null = null;
let gain = 1;

// Un groupe à part : le gain voix s'applique aussi à la réplique déjà en cours.
const voiceGroup = () => audioEngine().group("voix");

export function setHeroVoiceGain(value: number): void {
  gain = value;
  createdAudioEngine()
    ?.group("voix")
    .setVolume(clampVolume(VOICE_VOLUME * gain));
}

export function initHeroVoice(): Promise<void> {
  if (loading) return loading;
  loading = fetchJson(`${VOICE_BASE_PATH}/voix.json`, decodeAudioSpriteManifest)
    .then(async (manifest) => {
      durations = new Map(Object.entries(manifest.sprite).map(([key, [, ms]]) => [key, ms / 1000]));
      voiceGroup().setVolume(clampVolume(VOICE_VOLUME * gain));
      const sound = await loadFirstSound(manifest.src.map((f) => `${VOICE_BASE_PATH}/${f}`));
      if (sound) atlas = spriteSheet(sound, manifest.sprite);
      else console.warn(`[voix] atlas introuvable (${VOICE_BASE_PATH}/voix.{ogg,m4a}) — répliques muettes.`);
    })
    .catch((e) => {
      console.warn(`[voix] manifeste illisible (${e}) — répliques muettes.`);
    });
  return loading;
}

export function heroVoiceDuration(key: string): number | null {
  return durations.get(key) ?? null;
}

export function playHeroVoice(key: string): void {
  if (!atlas || !durations.has(key)) return;
  lectureEnCours?.stop();
  lectureEnCours = voiceGroup().playSprite(atlas, key);
}

/** Les haut-parleurs ne sont pas la bouche du héros : une annonce ne coupe ni sa réplique ni la queue de l'annonce d'avant. */
export function playAnnouncementVoice(key: string): void {
  if (!atlas || !durations.has(key)) return;
  voiceGroup().playSprite(atlas, key);
}

export function listHeroVoices(): { cle: string; duree: number }[] {
  return [...durations].map(([key, duration]) => ({ cle: key, duree: duration }));
}
