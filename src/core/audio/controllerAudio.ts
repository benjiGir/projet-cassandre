import { Howl } from "howler";
import { assetUrl } from "../loading/assetPath";
import { fetchJson } from "../net/fetchJson";
import { decodeAudioSpriteManifest } from "./audioManifest";
import { waitForAudioLoad, warmAudioPool } from "./audioPreparation";

const BASE = assetUrl("assets/audio/controleur");
let atlas: Howl | null = null;

export async function prepareControllerAudio(): Promise<void> {
  try {
    const manifest = await fetchJson(`${BASE}/controleur.json`, decodeAudioSpriteManifest);
    const voices = 6;
    atlas = new Howl({
      src: manifest.src.map((file) => `${BASE}/${file}`),
      sprite: manifest.sprite,
      pool: voices,
      onload: () => warmAudioPool(atlas!, "controleur_telegraph", voices),
    });
    await waitForAudioLoad(atlas);
  } catch (error) {
    console.warn("[audio] sons du Contrôleur indisponibles", error);
  }
}

export function playControllerCue(event: "alert" | "telegraph", gain: number, random: () => number): void {
  if (!atlas || atlas.state() !== "loaded") return;
  const id = atlas.play(`controleur_${event}`);
  if (id === undefined) return;
  atlas.volume(gain * (event === "alert" ? 0.8 : 0.65), id);
  atlas.rate(event === "alert" ? 0.96 + random() * 0.08 : 1, id);
}
