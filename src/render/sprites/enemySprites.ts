import * as THREE from "three";

import { assetUrl } from "../../core/loading/assetPath";
import { BILLBOARD_COLUMNS, createPlaceholderAtlas } from "./billboard";
import { configureRetroTexture } from "../pipeline/renderer";
import { decodeSpriteManifest } from "./enemySpriteManifest";
import { HUMAN_SKIN_VARIANTS } from "./enemySkinConfig";
import type { EnemyAnimationInput, EnemySpriteSheet, SpriteAnimation } from "./enemySpriteTypes";

// see: docs/6-reference/notes-code-rendu.md#planches-et-chargement-ennemi

export function createEnemyAnimationInput(): EnemyAnimationInput {
  return { pose: "idle", poseTime: 0, poseDuration: 0, clock: 0, stride: 0, timeSinceShot: Number.POSITIVE_INFINITY };
}

export function enemyHumanAtlas(sheet: EnemySpriteSheet, appearanceIndex: number): THREE.Texture {
  const skin = HUMAN_SKIN_VARIANTS[appearanceIndex % HUMAN_SKIN_VARIANTS.length];
  return sheet.atlases[skin] ?? sheet.atlases.humain;
}

const DEFAULT_FIRE_DURATION = 0.12; // s
const DEFAULT_IDLE_FPS = 1.5;
const DEFAULT_METERS_PER_CYCLE = 2.8;

function loopedRow(animation: SpriteAnimation, index: number): number {
  const frames = animation.frames;
  return animation.row + (((Math.floor(index) % frames) + frames) % frames);
}

function spreadRow(animation: SpriteAnimation, time: number, duration: number): number {
  const progress = duration > 0 ? time / duration : 1;
  const frame = Math.min(animation.frames - 1, Math.max(0, Math.floor(progress * animation.frames)));
  return animation.row + frame;
}

export function enemySpriteRow(sheet: EnemySpriteSheet, input: EnemyAnimationInput): number {
  const a = sheet.animations;
  switch (input.pose) {
    case "idle":
      return loopedRow(a.idle, input.clock * (a.idle.fps ?? DEFAULT_IDLE_FPS));
    case "alert":
      return spreadRow(a.alert, input.poseTime, input.poseDuration);
    case "chase":
      // La poursuite reprend le pas du tir ; conserver son éclair par-dessus la course.
      if (input.timeSinceShot < (a.fire.duration ?? DEFAULT_FIRE_DURATION)) return a.fire.row;
      return loopedRow(a.chase, (input.stride / (a.chase.metersPerCycle ?? DEFAULT_METERS_PER_CYCLE)) * a.chase.frames);
    case "aim":
      return a.aim.row;
    case "stagger":
      return spreadRow(a.stagger, input.poseTime, input.poseDuration);
    case "death":
      return spreadRow(a.death, input.poseTime, input.poseDuration);
    case "corpse":
      return a.death.row + a.death.frames - 1;
  }
}

// Aligne les pieds sur le bas de la capsule interpolée depuis son centre.
export function enemySpriteQuad(
  sheet: EnemySpriteSheet,
  capsuleBottomBelowCenter: number,
): { width: number; height: number; verticalAnchor: number } {
  const width = sheet.cellWidth / sheet.pixelsPerMeter;
  const height = sheet.cellHeight / sheet.pixelsPerMeter;
  const belowCenter = capsuleBottomBelowCenter + sheet.feetFromBottom / sheet.pixelsPerMeter;
  return { width, height, verticalAnchor: belowCenter / height };
}

// Frontière asynchrone de démarrage, jamais dans la boucle.
export async function loadEnemySpriteSheet(name: string): Promise<EnemySpriteSheet> {
  const response = await fetch(assetUrl(`assets/sprites/${name}.json`));
  if (!response.ok) throw new Error(`[sprites] ${name}.json : HTTP ${response.status}`);
  const manifest = decodeSpriteManifest(await response.json());

  const loader = new THREE.TextureLoader();
  const loaded = await Promise.allSettled(
    Object.entries(manifest.atlases).map(async ([skin, file]) => {
      const texture = await loader.loadAsync(assetUrl(`assets/sprites/${file}`));
      configureRetroTexture(texture);
      return [skin, texture] as const;
    }),
  );
  const entries: Array<readonly [string, THREE.Texture]> = [];
  let failed: PromiseRejectedResult | undefined;
  for (const result of loaded) {
    if (result.status === "fulfilled") entries.push(result.value);
    else failed ??= result;
  }
  if (failed) {
    // Attendre toutes les réponses permet de libérer même celles arrivées après l'échec.
    for (const [, texture] of entries) texture.dispose();
    throw failed.reason;
  }
  const atlases = Object.fromEntries(entries);

  return {
    cellWidth: manifest.cellWidth,
    cellHeight: manifest.cellHeight,
    rows: manifest.rows,
    pixelsPerMeter: manifest.pixelsPerMeter,
    feetFromBottom: manifest.feetFromBottom,
    animations: manifest.animations,
    atlases: { ...atlases, humain: atlases.humain },
  };
}

export function placeholderSpriteSheet(): EnemySpriteSheet {
  const rows = 10;
  const one = (row: number): SpriteAnimation => ({ row, frames: 1 });
  return {
    cellWidth: 32,
    cellHeight: 48,
    rows,
    pixelsPerMeter: 48 / 1.8,
    feetFromBottom: 0,
    animations: {
      idle: one(0),
      alert: one(1),
      chase: one(2),
      aim: one(3),
      fire: one(4),
      stagger: one(5),
      death: { row: 6, frames: 4 },
    },
    atlases: { humain: createPlaceholderAtlas(BILLBOARD_COLUMNS, rows) },
  };
}

export async function loadEnemySpriteSheetOrPlaceholder(name: string): Promise<EnemySpriteSheet> {
  try {
    return await loadEnemySpriteSheet(name);
  } catch (error) {
    console.error(`[sprites] planche "${name}" illisible, repli sur l'atlas numéroté`, error);
    return placeholderSpriteSheet();
  }
}
