import type { FiringWeapon } from "../../game/player/weapons/weaponTypes";
import { Howl, Howler } from "howler";
import { prepareTrainWarning, playTrainWarning as playPreparedTrainWarning } from "./trainWarning";

import {
  DEFAULT_IMPACT_SFX,
  DEFAULT_PROP_BREAK_SFX,
  DOOR_MOVEMENT_SFX,
  DOOR_SFX,
  ENEMY_SFX,
  MATERIAL_IMPACT_SFX,
  PITCH_VARIATION,
  POOL_LECTURES,
  PROP_BREAK_SFX,
  SFX_TABLE,
  WEAPON_FIRE_SFX,
} from "./audioCatalog";
import type { SfxId } from "./audioCatalog";
import type { DoorSfxEvent, EnemySfxEvent, EnemyVoice } from "./audioTypes";
import { decodeAudioSpriteManifest } from "./audioManifest";
import { assetUrl } from "../loading/assetPath";
import { waitForAudioLoad, warmAudioPool } from "./audioPreparation";
import type { DoorMovement } from "../../game/level/doors/doorTypes";
import { fetchJson } from "../net/fetchJson";

// Présentation : les lectures Howler restent hors du pas fixe.
// see: docs/6-reference/notes-code-core.md#adaptateurs-audio
const SFX_BASE_PATH = assetUrl("assets/audio/sfx");

let audioRandom: () => number = () => 0.5;

let sfxGain = 1;

export function setSfxGain(gain: number): void {
  sfxGain = gain;
}

export function setMasterGain(gain: number): void {
  Howler.volume(gain);
}

export function setAllMuted(muted: boolean): void {
  Howler.mute(muted);
}

/** Coupe tout ce qui joue, boucles comprises. Sans retour : c'est pour un jeu qui s'arrête. */
export function stopAllAudio(): void {
  Howler.stop();
}

export function setAudioRandom(random: () => number): void {
  audioRandom = random;
}

let atlas: Howl | null = null;
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
      const voices = manifest.pool ?? POOL_LECTURES;
      atlas = new Howl({
        src: manifest.src.map((f) => `${SFX_BASE_PATH}/${f}`),
        sprite: manifest.sprite,
        pool: voices,
        onload: () => {
          const sprite = Object.keys(manifest.sprite)[0];
          if (sprite) warmAudioPool(atlas!, sprite, voices);
        },
        onloaderror: () => warnOnce("atlas", `atlas introuvable (${SFX_BASE_PATH}/sfx.{ogg,m4a})`),
      });

      for (const id of Object.keys(SFX_TABLE) as SfxId[]) {
        const key = SFX_TABLE[id].sprite;
        if (!spriteKeys.has(key)) {
          warnOnce(id, `"${id}" pointe sur la recette "${key}", absente du sprite`);
        }
      }
      await Promise.all([waitForAudioLoad(atlas), prepareTrainWarning()]);
    })
    .catch((e) => {
      warnOnce("manifeste", `manifeste audio illisible (${e})`);
    });
  return loading;
}

// Gain et pitch par lecture : ne pas modifier les sons déjà en cours.
export function playSfx(id: SfxId, volumeScale = 1) {
  if (!atlas || atlas.state() !== "loaded") return;
  const def = SFX_TABLE[id];
  if (!spriteKeys.has(def.sprite)) return;

  const lecture = atlas.play(def.sprite);
  if (lecture === undefined) return;
  const p = def.pitch ?? PITCH_VARIATION;
  atlas.rate(1 - p + audioRandom() * p * 2, lecture);
  atlas.volume(def.volume * volumeScale * sfxGain, lecture);
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
