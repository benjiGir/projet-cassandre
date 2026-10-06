import { Howl } from "howler";
import { assetUrl } from "../loading/assetPath";
import { waitForAudioLoad, warmAudioPool } from "./audioPreparation";

let warning: Howl | null = null;

// see: docs/4-technique/trains-metro.md#alerte-sonore
export async function prepareTrainWarning(): Promise<void> {
  warning = new Howl({
    src: ["ogg", "m4a"].map((ext) => assetUrl(`assets/audio/metro_pilote/alerte.${ext}`)),
    sprite: { approach: [0, 450] },
    pool: 2,
    onload: () => warmAudioPool(warning!, "approach", 2),
    onloaderror: () => console.warn("[audio] Alerte du train indisponible."),
  });
  await waitForAudioLoad(warning);
}

export function playTrainWarning(gain: number): void {
  if (warning?.state() !== "loaded") return;
  const id = warning.play("approach");
  warning.volume(.22 * gain, id);
}
