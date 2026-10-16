import type { SpriteSheet } from "fx-audio";
import { assetUrl } from "../loading/assetPath";
import { audioEngine, clampVolume, loadFirstSound, spriteSheet } from "./audioEngine";

let warning: SpriteSheet | null = null;

// see: docs/4-technique/trains-metro.md#alerte-sonore
export async function prepareTrainWarning(): Promise<void> {
  const sound = await loadFirstSound(["ogg", "m4a"].map((ext) => assetUrl(`assets/audio/metro_pilote/alerte.${ext}`)));
  if (sound) warning = spriteSheet(sound, { approach: [0, 450] });
  else console.warn("[audio] Alerte du train indisponible.");
}

export function playTrainWarning(gain: number): void {
  if (!warning) return;
  audioEngine().playSprite(warning, "approach", { volume: clampVolume(0.22 * gain) });
}
