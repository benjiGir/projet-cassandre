import type { SpriteSheet } from "fx-audio";
import { assetUrl } from "../loading/assetPath";
import { fetchJson } from "../net/fetchJson";
import { decodeAudioSpriteManifest } from "./audioManifest";
import { audioEngine, clampVolume, loadFirstSound, spriteSheet } from "./audioEngine";

const BASE = assetUrl("assets/audio/controleur");
let atlas: SpriteSheet | null = null;

export async function prepareControllerAudio(): Promise<void> {
  try {
    const manifest = await fetchJson(`${BASE}/controleur.json`, decodeAudioSpriteManifest);
    const sound = await loadFirstSound(manifest.src.map((file) => `${BASE}/${file}`));
    if (sound) atlas = spriteSheet(sound, manifest.sprite);
    else console.warn("[audio] sons du Contrôleur indisponibles");
  } catch (error) {
    console.warn("[audio] sons du Contrôleur indisponibles", error);
  }
}

export function playControllerCue(event: "alert" | "telegraph", gain: number, random: () => number): void {
  if (!atlas) return;
  audioEngine().playSprite(atlas, `controleur_${event}`, {
    volume: clampVolume(gain * (event === "alert" ? 0.8 : 0.65)),
    rate: event === "alert" ? 0.96 + random() * 0.08 : 1,
  });
}
