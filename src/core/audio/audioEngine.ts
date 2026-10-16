import { SpriteSegment, SpriteSheet } from "fx-audio";
import type { Sound } from "fx-audio";
import { createAudio } from "fx-audio/promise";
import type { PromiseAudio } from "fx-audio/promise";

// Moteur audio partagé : un seul contexte Web Audio pour tout le jeu, créé à la première demande.
// fx-audio reprend le contexte au premier clic, touche ou toucher, et après une interruption.
// see: docs/6-reference/notes-code-core.md#adaptateurs-audio

const LOAD_TIMEOUT_MS = 15000;

let engine: PromiseAudio | null = null;
let masterVolume = 1;
let masterMuted = false;

export function audioEngine(): PromiseAudio {
  if (!engine) {
    engine = createAudio();
    engine.master.setVolume(masterVolume);
    if (masterMuted) engine.master.mute();
  }
  return engine;
}

/** Le moteur s'il existe déjà : les réglages ne doivent pas ouvrir un contexte audio à eux seuls. */
export function createdAudioEngine(): PromiseAudio | null {
  return engine;
}

/** Gain général et coupure globale, retenus jusqu'à la création du moteur. */
export function setMasterVolume(volume: number): void {
  masterVolume = clampVolume(volume);
  engine?.master.setVolume(masterVolume);
}

export function setMasterMuted(muted: boolean): void {
  masterMuted = muted;
  if (!engine) return;
  if (muted) engine.master.mute();
  else engine.master.unmute();
}

/**
 * Charge le premier fichier lisible de la liste (`.ogg` d'abord, `.m4a` en repli : un navigateur
 * qui ne décode pas l'un décode l'autre). Rend `null` si aucun ne l'est ou si le délai est dépassé.
 */
export async function loadFirstSound(urls: readonly string[]): Promise<Sound | null> {
  for (const url of urls) {
    try {
      return await audioEngine().load(url, AbortSignal.timeout(LOAD_TIMEOUT_MS));
    } catch {
      // Format illisible ou fichier absent : on tente le suivant.
    }
  }
  return null;
}

/** Un sprite `{ nom: [début, durée] }` en millisecondes devient un `SpriteSheet`. */
export function spriteSheet(sound: Sound, sprite: Readonly<Record<string, readonly [number, number]>>): SpriteSheet {
  return new SpriteSheet({
    sound,
    segments: Object.fromEntries(
      Object.entries(sprite).map(([name, [start, duration]]) => [name, new SpriteSegment({ start, duration })]),
    ),
  });
}

/** Un segment qui boucle dans ses propres bornes (la nappe d'une zone). */
export function loopingSheet(sound: Sound, name: string, start: number, duration: number): SpriteSheet {
  return new SpriteSheet({ sound, segments: { [name]: new SpriteSegment({ start, duration, loop: true }) } });
}

/** fx-audio refuse un volume négatif ou non fini ; une erreur de réglage ne doit pas arrêter le jeu. */
export function clampVolume(volume: number): number {
  return Number.isFinite(volume) ? Math.max(0, volume) : 0;
}
