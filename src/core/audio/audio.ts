import { Howl, Howler } from "howler";

import {
  DEFAULT_IMPACT_SFX, DEFAULT_PROP_BREAK_SFX, DOOR_MOVEMENT_SFX, DOOR_SFX,
  ENEMY_SFX, MATERIAL_IMPACT_SFX, PITCH_VARIATION, POOL_LECTURES, PROP_BREAK_SFX,
  SFX_TABLE, WEAPON_FIRE_SFX,
} from "./audioCatalog";
import type { DoorSfxEvent, EnemySfxEvent, EnemyVoice, SfxId } from "./audioTypes";
import { decodeAudioSpriteManifest } from "./audioManifest";
import { assetUrl } from "../loading/assetPath";
import { waitForAudioLoad, warmAudioPool } from "./audioPreparation";
import type { DoorMovement } from "../../game/level/doors/doorTypes";

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

export function setAudioRandom(random: () => number): void {
  audioRandom = random;
}

let atlas: Howl | null = null;
let cles: Set<string> = new Set();
let chargement: Promise<void> | null = null;
const avertis = new Set<string>();

function avertirUneFois(cle: string, raison: string) {
  if (avertis.has(cle)) return;
  avertis.add(cle);
  console.warn(`[audio] ${raison} — le jeu continue sans ce son.`);
}

export function initAudio(): Promise<void> {
  if (chargement) return chargement;

  chargement = fetch(`${SFX_BASE_PATH}/sfx.json`, { signal: AbortSignal.timeout(15000) })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(decodeAudioSpriteManifest)
    .then(async (manifeste) => {
      cles = new Set(Object.keys(manifeste.sprite));
      const voices = manifeste.pool ?? POOL_LECTURES;
      atlas = new Howl({
        src: manifeste.src.map((f) => `${SFX_BASE_PATH}/${f}`),
        sprite: manifeste.sprite,
        pool: voices,
        onload: () => {
          const sprite = Object.keys(manifeste.sprite)[0];
          if (sprite) warmAudioPool(atlas!, sprite, voices);
        },
        onloaderror: () =>
          avertirUneFois("atlas", `atlas introuvable (${SFX_BASE_PATH}/sfx.{ogg,m4a})`),
      });

      for (const id of Object.keys(SFX_TABLE) as SfxId[]) {
        const cle = SFX_TABLE[id].sprite;
        if (!cles.has(cle)) {
          avertirUneFois(id, `"${id}" pointe sur la recette "${cle}", absente du sprite`);
        }
      }
      await waitForAudioLoad(atlas);
    })
    .catch((e) => {
      avertirUneFois("manifeste", `manifeste audio illisible (${e})`);
    });
  return chargement;
}

// Gain et pitch par lecture : ne pas modifier les sons déjà en cours.
export function playSfx(id: SfxId, volumeScale = 1) {
  if (!atlas || atlas.state() !== "loaded") return;
  const def = SFX_TABLE[id];
  if (!cles.has(def.sprite)) return;

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
    present: cles.has(SFX_TABLE[id].sprite),
  }));
}

export function playWeaponFireSfx(weapon: "melee" | "pistol" | "shotgun") {
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
