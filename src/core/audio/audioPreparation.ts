import { Howl, Howler } from "howler";

const LOAD_TIMEOUT_MS = 15000;
let activationInstalled = false;

// see: docs/6-reference/notes-code-core.md#adaptateurs-audio
export function installAudioActivation(): void {
  if (activationInstalled) return;
  activationInstalled = true;
  Howler.autoSuspend = false;
  const resume = () => {
    const context = Howler.ctx;
    if (context && context.state !== "running" && context.state !== "closed") {
      void context.resume().catch(() => {});
    }
  };
  document.addEventListener("pointerdown", resume, { capture: true });
  document.addEventListener("keydown", resume, { capture: true });
}

export function waitForAudioLoad(howl: Howl): Promise<boolean> {
  if (howl.state() === "loaded") return Promise.resolve(true);
  if (Howler.noAudio) return Promise.resolve(false);
  return new Promise((resolve) => {
    const finish = (loaded: boolean) => {
      clearTimeout(timeout);
      howl.off("load", onLoad);
      howl.off("loaderror", onError);
      resolve(loaded);
    };
    const onLoad = () => finish(true);
    const onError = () => finish(false);
    const timeout = globalThis.setTimeout(() => {
      console.warn("[audio] préparation trop longue — le jeu continue sans attendre ce fichier.");
      finish(false);
    }, LOAD_TIMEOUT_MS);
    howl.once("load", onLoad);
    howl.once("loaderror", onError);
  });
}

export function warmAudioPool(howl: Howl, sprite: string, voices: number): void {
  if (!Howler.usingWebAudio || howl.state() !== "loaded") return;
  const volume = howl.volume();
  howl.volume(0);
  try {
    for (let i = 0; i < voices; i++) {
      const id = howl.play(sprite);
      if (typeof id !== "number") continue;
      howl.mute(true, id);
      howl.once("play", () => {
        howl.stop(id);
        howl.mute(false, id);
      }, id);
    }
  } finally {
    howl.volume(volume);
  }
}
