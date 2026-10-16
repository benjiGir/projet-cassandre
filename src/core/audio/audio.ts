import type { FiringWeapon } from "../../game/player/weapons/weaponTypes";
import type { SpriteSheet } from "fx-audio";
import { prepareTrainWarning, playTrainWarning as playPreparedTrainWarning } from "./trainWarning";
import { prepareControllerAudio, playControllerCue } from "./controllerAudio";

import {
  DEFAULT_IMPACT_SFX,
  DEFAULT_PROP_BREAK_SFX,
  DOOR_MOVEMENT_SFX,
  DOOR_SFX,
  ENEMY_SFX,
  MATERIAL_IMPACT_SFX,
  PITCH_VARIATION,
  PROP_BREAK_SFX,
  SFX_TABLE,
  WEAPON_FIRE_SFX,
} from "./audioCatalog";
import type { SfxId } from "./audioCatalog";
import type { DoorSfxEvent, EnemySfxEvent, EnemyVoice } from "./audioTypes";
import { decodeAudioSpriteManifest } from "./audioManifest";
import { assetUrl } from "../loading/assetPath";
import {
  audioEngine,
  clampVolume,
  createdAudioEngine,
  loadFirstSound,
  setMasterMuted,
  setMasterVolume,
  spriteSheet,
} from "./audioEngine";
import type { DoorMovement } from "../../game/level/doors/doorTypes";
import { fetchJson } from "../net/fetchJson";

// Présentation : les lectures restent hors du pas fixe.
// see: docs/6-reference/notes-code-core.md#adaptateurs-audio
const SFX_BASE_PATH = assetUrl("assets/audio/sfx");

let audioRandom: () => number = () => 0.5;

let sfxGain = 1;

export function setSfxGain(gain: number): void {
  sfxGain = gain;
}

export function setMasterGain(gain: number): void {
  setMasterVolume(gain);
}

export function setAllMuted(muted: boolean): void {
  setMasterMuted(muted);
}

/** Coupe tout ce qui joue, boucles comprises. Sans retour : c'est pour un jeu qui s'arrête. */
export function stopAllAudio(): void {
  createdAudioEngine()?.master.stopAll();
}

export function setAudioRandom(random: () => number): void {
  audioRandom = random;
}

let atlas: SpriteSheet | null = null;
let spriteKeys: Set<string> = new Set();
let loading: Promise<void> | null = null;
const warned = new Set<string>();

function warnOnce(key: string, reason: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[audio] ${reason} — le jeu continue sans ce son.`);
}

export function initAudio(): Promise<void> {
  if (loading) return loading;

  loading = fetchJson(`${SFX_BASE_PATH}/sfx.json`, decodeAudioSpriteManifest)
    .then(async (manifest) => {
      spriteKeys = new Set(Object.keys(manifest.sprite));
      const sound = await loadFirstSound(manifest.src.map((f) => `${SFX_BASE_PATH}/${f}`));
      if (sound) atlas = spriteSheet(sound, manifest.sprite);
      else warnOnce("atlas", `atlas introuvable (${SFX_BASE_PATH}/sfx.{ogg,m4a})`);

      for (const id of Object.keys(SFX_TABLE) as SfxId[]) {
        const key = SFX_TABLE[id].sprite;
        if (!spriteKeys.has(key)) {
          warnOnce(id, `"${id}" pointe sur la recette "${key}", absente du sprite`);
        }
      }
      await Promise.all([prepareTrainWarning(), prepareControllerAudio()]);
    })
    .catch((e) => {
      warnOnce("manifeste", `manifeste audio illisible (${e})`);
    });
  return loading;
}

// Gain et pitch par lecture : ne pas modifier les sons déjà en cours.
export function playSfx(id: SfxId, volumeScale = 1) {
  if (!atlas) return;
  const def = SFX_TABLE[id];
  if (!spriteKeys.has(def.sprite)) return;

  const p = def.pitch ?? PITCH_VARIATION;
  audioEngine().playSprite(atlas, def.sprite, {
    rate: 1 - p + audioRandom() * p * 2,
    volume: clampVolume(def.volume * volumeScale * sfxGain),
  });
}

export function listSfx(): { id: SfxId; recette: string; present: boolean }[] {
  return (Object.keys(SFX_TABLE) as SfxId[]).map((id) => ({
    id,
    recette: SFX_TABLE[id].sprite,
    present: spriteKeys.has(SFX_TABLE[id].sprite),
  }));
}

export function playWeaponFireSfx(weapon: FiringWeapon) {
  playSfx(WEAPON_FIRE_SFX[weapon]);
}

export function playImpactSfx(material: string) {
  playSfx(MATERIAL_IMPACT_SFX[material] ?? DEFAULT_IMPACT_SFX);
}

export function playPropBreakSfx(matiere: string) {
  playSfx(PROP_BREAK_SFX[matiere] ?? DEFAULT_PROP_BREAK_SFX);
}

export function playEnemySfx(event: EnemySfxEvent, voice: EnemyVoice = "costard") {
  if ((voice === "controleur" || voice === "chef_brigade") && (event === "alert" || event === "telegraph")) {
    playControllerCue(event, sfxGain, audioRandom);
    return;
  }
  playSfx(ENEMY_SFX[voice][event]);
}

export function playDoorSfx(event: DoorSfxEvent) {
  playSfx(DOOR_SFX[event]);
}

export function playDoorMovementSfx(movement: DoorMovement) {
  playSfx(DOOR_MOVEMENT_SFX[movement]);
}

export function playTrainWarning(): void {
  playPreparedTrainWarning(sfxGain);
}
