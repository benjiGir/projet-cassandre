import { setAllMuted, setMasterGain, setSfxGain } from "../../core/audio/audio";
import { setHeroVoiceGain } from "../../core/audio/heroVoice";
import { setShowerAmbienceGain } from "../../core/audio/showerAmbience";
import { setWaterAmbienceGain } from "../../core/audio/waterAmbience";
import { setZoneAmbienceGain } from "../../core/audio/zoneAmbience";
import { persisted } from "../../core/storage/persisted";

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
  /** Afficher le chat du direct dans le HUD. */
  chatDuDirect: boolean;
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
  chatDuDirect: true,
};

const CHANNELS: readonly AudioChannel[] = ["general", "effets", "voix", "ambiances"];

function clamp01(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

/** Un champ illisible ou hors bornes reprend sa valeur d'origine, sans faire perdre les autres. */
function decodeSettings(stored: unknown): AudioSettings {
  const parsed = stored as Partial<AudioSettings>;
  const settings = { ...FACTORY_DEFAULTS };
  for (const channel of CHANNELS) settings[channel] = clamp01(parsed[channel], FACTORY_DEFAULTS[channel]);
  if (typeof parsed.sousTitres === "boolean") settings.sousTitres = parsed.sousTitres;
  if (typeof parsed.muetEnArrierePlan === "boolean") settings.muetEnArrierePlan = parsed.muetEnArrierePlan;
  if (typeof parsed.chatDuDirect === "boolean") settings.chatDuDirect = parsed.chatDuDirect;
  return settings;
}

const stored = persisted(STORAGE_KEY, decodeSettings, () => ({ ...FACTORY_DEFAULTS }));

/** Valeur affichée (0..1) -> gain. Le carré suit mieux l'oreille qu'une droite. */
export function channelGain(value: number): number {
  return value * value;
}

let current: AudioSettings = stored.load();

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
  current = stored.load();
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
  stored.save(current);
  apply(current);
  return current;
}

export function resetAudioSettings(): AudioSettings {
  return setAudioSettings(FACTORY_DEFAULTS);
}

/** Le chat du direct est-il affiché ? Lu par `session/stream/streamFeed.ts` à chaque message. */
export function chatEnabled(): boolean {
  return current.chatDuDirect;
}

/** Les sous-titres des répliques sont-ils affichés ? Lu par `session/feedback.ts::triggerHeroLine`. */
export function subtitlesEnabled(): boolean {
  return current.sousTitres;
}
