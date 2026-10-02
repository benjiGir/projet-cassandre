import { playSfx } from "../../../../../core/audio";
import { playHeroVoice } from "../../../../../core/heroVoice";
import type { AudioChannel } from "../../../../../game/audioSettings";

export interface AudioChannelRow {
  id: AudioChannel;
  label: string;
  /** Un son représentatif du canal ; absent pour les canaux qui jouent déjà en continu (musique, nappe). */
  preview?: () => void;
}

/** Les tranches de la table de mixage, dans l'ordre d'affichage. */
export const AUDIO_CHANNELS: readonly AudioChannelRow[] = [
  { id: "general", label: "GÉNÉRAL", preview: () => playSfx("secret_found") },
  { id: "musique", label: "MUSIQUE" },
  { id: "effets", label: "EFFETS", preview: () => playSfx("pistol_fire") },
  { id: "voix", label: "VOIX DU HÉROS", preview: () => playHeroVoice("heros_depart_a") },
  { id: "ambiances", label: "AMBIANCES" },
];
