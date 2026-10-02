import { Howl } from "howler";

import { assetUrl } from "./assetPath";
import { waitForAudioLoad } from "./audioPreparation";

/**
 * Voix du héros : les répliques enregistrées (`tools/audio/ia_voix.py`),
 * empaquetées en un sprite à part de celui des SFX — `voix.{ogg,m4a,json}`.
 *
 * UNE bouche, donc UNE lecture à la fois : une nouvelle réplique coupe celle
 * qui parle encore. Aucune variation de hauteur (une voix qui change de
 * hauteur d'une phrase à l'autre change de personnage).
 *
 * Le choix de QUOI dire et QUAND vit dans `game/session/feedback.ts` ; ce
 * module ne connaît que des clés de sprite (`heros_<identifiant>_a`).
 */

const VOIX_BASE_PATH = assetUrl("assets/audio/voix");
const VOIX_VOLUME = 1.0;

interface VoiceManifest {
  src: string[];
  sprite: Record<string, [number, number]>;
}

let atlas: Howl | null = null;
let durees = new Map<string, number>();
let lectureEnCours: number | null = null;
let chargement: Promise<void> | null = null;
let gain = 1;

/** Gain du canal « voix » réglé par le joueur (`game/audioSettings.ts`). Effectif tout de suite. */
export function setHeroVoiceGain(value: number): void {
  gain = value;
  atlas?.volume(VOIX_VOLUME * gain);
}

/** Charge le sprite des voix. Idempotent ; un fichier absent laisse le jeu muet, jamais en panne. */
export function initHeroVoice(): Promise<void> {
  if (chargement) return chargement;
  chargement = fetch(`${VOIX_BASE_PATH}/voix.json`, { signal: AbortSignal.timeout(15000) })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(async (manifeste: VoiceManifest) => {
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

/** Durée de la prise en secondes, `null` si elle n'est pas dans le sprite. */
export function heroVoiceDuration(cle: string): number | null {
  return durees.get(cle) ?? null;
}

/** Joue une prise en coupant celle qui parle encore. Sans effet si l'atlas n'est pas prêt. */
export function playHeroVoice(cle: string): void {
  if (!atlas || atlas.state() !== "loaded" || !durees.has(cle)) return;
  if (lectureEnCours !== null) atlas.stop(lectureEnCours);
  lectureEnCours = atlas.play(cle) ?? null;
}

/** Pour la console de debug : chaque clé du sprite et sa durée. */
export function listHeroVoices(): { cle: string; duree: number }[] {
  return [...durees].map(([cle, duree]) => ({ cle, duree }));
}
