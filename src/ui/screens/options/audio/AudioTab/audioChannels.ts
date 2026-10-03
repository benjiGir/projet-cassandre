import { playSfx } from "../../../../../core/audio/audio";
import { playHeroVoice } from "../../../../../core/audio/heroVoice";
import type { AudioChannel } from "../../../../../game/settings/audioSettings";

export interface AudioChannelRow {
  id: AudioChannel;
  label: string;
  preview?: () => void;
}

export const AUDIO_CHANNELS: readonly AudioChannelRow[] = [
  { id: "general", label: "GÉNÉRAL", preview: () => playSfx("secret_found") },
  { id: "effets", label: "EFFETS", preview: () => playSfx("pistol_fire") },
  { id: "voix", label: "VOIX DU HÉROS", preview: () => playHeroVoice("heros_depart_a") },
  { id: "ambiances", label: "AMBIANCES" },
];
