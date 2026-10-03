import { Howl } from "howler";

import { decodeAudioSpriteManifest } from "./audioManifest";
import { assetUrl } from "../loading/assetPath";
import { waitForAudioLoad } from "./audioPreparation";

// see: docs/6-reference/notes-code-core.md#adaptateurs-audio

const VOIX_BASE_PATH = assetUrl("assets/audio/voix");
const VOIX_VOLUME = 1.0;

let atlas: Howl | null = null;
let durees = new Map<string, number>();
let lectureEnCours: number | null = null;
let chargement: Promise<void> | null = null;
let gain = 1;

export function setHeroVoiceGain(value: number): void {
  gain = value;
  atlas?.volume(VOIX_VOLUME * gain);
}

export function initHeroVoice(): Promise<void> {
  if (chargement) return chargement;
  chargement = fetch(`${VOIX_BASE_PATH}/voix.json`, { signal: AbortSignal.timeout(15000) })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(decodeAudioSpriteManifest)
    .then(async (manifeste) => {
      durees = new Map(Object.entries(manifeste.sprite).map(([cle, [, ms]]) => [cle, ms / 1000]));
      atlas = new Howl({
        src: manifeste.src.map((f) => `${VOIX_BASE_PATH}/${f}`),
        sprite: manifeste.sprite,
        pool: 2,
        volume: VOIX_VOLUME * gain,
        onloaderror: () => console.warn(`[voix] atlas introuvable (${VOIX_BASE_PATH}/voix.{ogg,m4a}) — répliques muettes.`),
      });
      await waitForAudioLoad(atlas);
    })
    .catch((e) => {
      console.warn(`[voix] manifeste illisible (${e}) — répliques muettes.`);
    });
  return chargement;
}

export function heroVoiceDuration(cle: string): number | null {
  return durees.get(cle) ?? null;
}

export function playHeroVoice(cle: string): void {
  if (!atlas || atlas.state() !== "loaded" || !durees.has(cle)) return;
  if (lectureEnCours !== null) atlas.stop(lectureEnCours);
  lectureEnCours = atlas.play(cle) ?? null;
}

export function listHeroVoices(): { cle: string; duree: number }[] {
  return [...durees].map(([cle, duree]) => ({ cle, duree }));
}
