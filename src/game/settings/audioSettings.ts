import { setAllMuted, setMasterGain, setSfxGain } from "../../core/audio/audio";
import { setHeroVoiceGain } from "../../core/audio/heroVoice";
import { setShowerAmbienceGain } from "../../core/audio/showerAmbience";
import { setWaterAmbienceGain } from "../../core/audio/waterAmbience";
import { setZoneAmbienceGain } from "../../core/audio/zoneAmbience";

// see: docs/6-reference/notes-code-gameplay-outils.md#réglages

export interface AudioSettings {
  /** 0 à 1, valeur affichée (pas le gain) — coiffe tous les canaux. */
  general: number;
  effets: number;
  /** Les répliques enregistrées du héros. */
  voix: number;
  /** Ambiances de zone, jets d'eau, douches. */
  ambiances: number;
  /** Afficher le texte des répliques sous la webcam du héros. */
  sousTitres: boolean;
  /** Couper tout le son quand la fenêtre n'a plus le focus. */
  muetEnArrierePlan: boolean;
}

export type AudioChannel = "general" | "effets" | "voix" | "ambiances";

const STORAGE_KEY = "cassandre.audio";

const FACTORY_DEFAULTS: AudioSettings = {
  general: 1,
  effets: 1,
  voix: 1,
  ambiances: 1,
  sousTitres: true,
  muetEnArrierePlan: false,
};

const CHANNELS: readonly AudioChannel[] = ["general", "effets", "voix", "ambiances"];

function clamp01(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

/** Ne throw jamais, dégrade sur les valeurs d'origine — même discipline que `graphicsSettings.ts`. */
function loadPersisted(): AudioSettings {
  if (typeof localStorage === "undefined") return { ...FACTORY_DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...FACTORY_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    const settings = { ...FACTORY_DEFAULTS };
    for (const channel of CHANNELS) settings[channel] = clamp01(parsed[channel], FACTORY_DEFAULTS[channel]);
    if (typeof parsed.sousTitres === "boolean") settings.sousTitres = parsed.sousTitres;
    if (typeof parsed.muetEnArrierePlan === "boolean") settings.muetEnArrierePlan = parsed.muetEnArrierePlan;
    return settings;
  } catch {
    return { ...FACTORY_DEFAULTS };
  }
}

function savePersisted(settings: AudioSettings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Dégrade silencieusement, même discipline que `core/input/input.ts`.
  }
}

/** Valeur affichée (0..1) -> gain. Le carré suit mieux l'oreille qu'une droite. */
export function channelGain(value: number): number {
  return value * value;
}

let current: AudioSettings = loadPersisted();

function apply(settings: AudioSettings): void {
  setMasterGain(channelGain(settings.general));
  setSfxGain(channelGain(settings.effets));
  setHeroVoiceGain(channelGain(settings.voix));
  const ambiances = channelGain(settings.ambiances);
  setZoneAmbienceGain(ambiances);
  setWaterAmbienceGain(ambiances);
  setShowerAmbienceGain(ambiances);
  applyBackgroundMute();
}

function windowInBackground(): boolean {
  return typeof document !== "undefined" && (document.hidden || !document.hasFocus());
}

function applyBackgroundMute(): void {
  setAllMuted(current.muetEnArrierePlan && windowInBackground());
}

let focusListenersInstalled = false;

export function initAudioSettingsAtBoot(): AudioSettings {
  current = loadPersisted();
  apply(current);
  if (!focusListenersInstalled && typeof window !== "undefined") {
    focusListenersInstalled = true;
    window.addEventListener("blur", applyBackgroundMute);
    window.addEventListener("focus", applyBackgroundMute);
    document.addEventListener("visibilitychange", applyBackgroundMute);
  }
  return current;
}

export function getAudioSettings(): AudioSettings {
  return current;
}

export function getAudioFactoryDefaults(): AudioSettings {
  return FACTORY_DEFAULTS;
}

/** Appelée par l'écran de réglages à chaque interaction : persiste et applique tout de suite. */
export function setAudioSettings(partial: Partial<AudioSettings>): AudioSettings {
  current = { ...current, ...partial };
  savePersisted(current);
  apply(current);
  return current;
}

export function resetAudioSettings(): AudioSettings {
  return setAudioSettings(FACTORY_DEFAULTS);
}

/** Les sous-titres des répliques sont-ils affichés ? Lu par `session/feedback.ts::triggerHeroLine`. */
export function subtitlesEnabled(): boolean {
  return current.sousTitres;
}
