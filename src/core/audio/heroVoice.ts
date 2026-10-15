import { Howl } from "howler";

import { decodeAudioSpriteManifest } from "./audioManifest";
import { assetUrl } from "../loading/assetPath";
import { waitForAudioLoad } from "./audioPreparation";
import { fetchJson } from "../net/fetchJson";

// see: docs/6-reference/notes-code-core.md#adaptateurs-audio

const VOICE_BASE_PATH = assetUrl("assets/audio/voix");
const VOICE_VOLUME = 1.0;

let atlas: Howl | null = null;
let durations = new Map<string, number>();
let lectureEnCours: number | null = null;
let loading: Promise<void> | null = null;
let gain = 1;

export function setHeroVoiceGain(value: number): void {
  gain = value;
  atlas?.volume(VOICE_VOLUME * gain);
}

export function initHeroVoice(): Promise<void> {
  if (loading) return loading;
  loading = fetchJson(`${VOICE_BASE_PATH}/voix.json`, decodeAudioSpriteManifest)
    .then(async (manifest) => {
      durations = new Map(Object.entries(manifest.sprite).map(([key, [, ms]]) => [key, ms / 1000]));
      atlas = new Howl({
        src: manifest.src.map((f) => `${VOICE_BASE_PATH}/${f}`),
        sprite: manifest.sprite,
        pool: 2,
        volume: VOICE_VOLUME * gain,
        onloaderror: () =>
          console.warn(`[voix] atlas introuvable (${VOICE_BASE_PATH}/voix.{ogg,m4a}) — répliques muettes.`),
      });
      await waitForAudioLoad(atlas);
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
  if (!atlas || atlas.state() !== "loaded" || !durations.has(key)) return;
  if (lectureEnCours !== null) atlas.stop(lectureEnCours);
  lectureEnCours = atlas.play(key) ?? null;
}

/** Les haut-parleurs ne sont pas la bouche du héros : une annonce ne coupe ni sa réplique ni la queue de l'annonce d'avant. */
export function playAnnouncementVoice(key: string): void {
  if (!atlas || atlas.state() !== "loaded" || !durations.has(key)) return;
  atlas.play(key);
}

export function listHeroVoices(): { cle: string; duree: number }[] {
  return [...durations].map(([key, duration]) => ({ cle: key, duree: duration }));
}
