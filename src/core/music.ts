import { Howl } from "howler";

import { assetUrl } from "./assetPath";

/**
 * Musique et nappe d'ambiance (Phase 6). Périmètre séparé de
 * `core/audio.ts` (SFX ponctuels) — voir la doc pour la répartition des
 * rôles et le statut placeholder des pistes.
 *
 * see: docs/systems/hud-audio.md#musique-et-nappe-dambiance
 */

const MUSIC_BASE_PATH = assetUrl("assets/audio/music");

/** Volume de repos de la musique — assez présent pour exister, jamais au point de couvrir les SFX de combat (priorité gameplay > habillage, hiérarchie du skill retro-fps-invariants). */
const MUSIC_VOLUME = 0.32;
/** -6 dB ≈ ×0.501 (20·log10(0.501) ≈ -6.0), valeur EXACTE demandée par le skill `audio-sfx-pipeline` pour le ducking pendant une réplique. */
const DUCK_ATTENUATION = 0.501;
/** Nappe d'ambiance : nettement plus discrète que la musique, c'est un bruit de fond, pas un thème. */
const AMBIENCE_VOLUME = 0.18;

/** Durée de la remontée après ducking — valeur EXACTE du skill `audio-sfx-pipeline`. */
const DUCK_RESTORE_MS = 400;
/** Descente rapide au déclenchement d'une réplique — volontairement plus courte que la remontée (une chute lente laisserait la ligne partiellement couverte par la musique à pleine puissance). */
const DUCK_ATTACK_MS = 80;

let ambience: Howl | null = null;
let music: Howl | null = null;

const MUSIC_ENABLED_STORAGE_KEY = "cassandre.musicEnabled";

function loadMusicEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    return localStorage.getItem(MUSIC_ENABLED_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function saveMusicEnabled(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(MUSIC_ENABLED_STORAGE_KEY, String(enabled));
  } catch {
    // Dégrade silencieusement, même discipline que `core/input.ts`.
  }
}

// Persisté (localStorage), jamais `ambience` — la nappe de fond reste
// toujours audible, seul le thème peut être coupé par le joueur.
let musicEnabled = loadMusicEnabled();

/** Volume cible du thème compte tenu du réglage joueur — 0 si désactivé. */
function baseMusicVolume(): number {
  return musicEnabled ? MUSIC_VOLUME : 0;
}

export function isMusicEnabled(): boolean {
  return musicEnabled;
}

/**
 * Coupe/remet le thème (jamais `ambience`). Persisté immédiatement, effectif
 * immédiatement (fade court, même durée que la remontée post-réplique) —
 * pas besoin de relancer une partie pour que le réglage s'applique.
 * `duckMusicForHeroLine`/`restoreMusicVolume` visent toutes deux
 * `baseMusicVolume()`, donc une réplique du héros pendant la musique coupée
 * ne la fait pas réapparaître par erreur.
 */
export function setMusicEnabled(enabled: boolean): void {
  if (musicEnabled === enabled) return;
  musicEnabled = enabled;
  saveMusicEnabled(enabled);
  music?.fade(music.volume(), baseMusicVolume(), DUCK_RESTORE_MS);
}

export function toggleMusic(): boolean {
  setMusicEnabled(!musicEnabled);
  return musicEnabled;
}

/**
 * Construit les deux `Howl` de fond et démarre leur lecture en boucle.
 * Idempotent (même discipline que `initAudio` dans `audio.ts`) : un second
 * appel ne recrée rien. À appeler UNE FOIS au boot, après `initAudio()`.
 */
export function initMusic() {
  if (ambience || music) return;

  ambience = new Howl({
    src: [`${MUSIC_BASE_PATH}/ambience_hum.ogg`, `${MUSIC_BASE_PATH}/ambience_hum.m4a`],
    html5: true,
    loop: true,
    volume: AMBIENCE_VOLUME,
    onloaderror: () => warnMissingOnce("ambience_hum"),
  });
  music = new Howl({
    src: [`${MUSIC_BASE_PATH}/theme_placeholder.ogg`, `${MUSIC_BASE_PATH}/theme_placeholder.m4a`],
    html5: true,
    loop: true,
    // Toujours joué, même à 0 (réglage désactivé) : évite de rejouer depuis
    // le début à la réactivation, `setMusicEnabled` ne fait alors qu'un fade.
    volume: baseMusicVolume(),
    onloaderror: () => warnMissingOnce("theme_placeholder"),
  });

  // `.play()` avant unlock est sûr (voir la doc de tête) : Howler met en
  // attente, jamais d'exception.
  try {
    ambience.play();
    music.play();
  } catch {
    // Défensif, même discipline que `SfxPool` dans `audio.ts` : un throw
    // synchrone imprévu ne doit jamais empêcher le reste du boot.
  }
}

const warnedIds = new Set<string>();
function warnMissingOnce(id: string) {
  if (warnedIds.has(id)) return;
  warnedIds.add(id);
  console.warn(`[music] piste "${id}" introuvable sous ${MUSIC_BASE_PATH}/ — le jeu continue sans elle.`);
}

/**
 * Ducking musique -6 dB (descente rapide). N'agit QUE sur `music`, jamais
 * `ambience`. No-op si `initMusic()` n'a pas encore tourné. Descente et
 * remontée sont deux fonctions SÉPARÉES, pas un minuteur interne — voir la
 * doc pour le pourquoi.
 *
 * see: docs/systems/hud-audio.md#ducking-pendant-les-répliques
 */
export function duckMusicForHeroLine() {
  music?.fade(music.volume(), baseMusicVolume() * DUCK_ATTENUATION, DUCK_ATTACK_MS);
}

/** Remontée sur 400 ms (`DUCK_RESTORE_MS`, valeur exacte du skill `audio-sfx-pipeline`) — voir la doc de `duckMusicForHeroLine`. */
export function restoreMusicVolume() {
  music?.fade(music.volume(), baseMusicVolume(), DUCK_RESTORE_MS);
}
