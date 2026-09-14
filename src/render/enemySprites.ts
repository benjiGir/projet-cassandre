import * as THREE from "three";

import { assetUrl } from "../core/assetPath";
import { BILLBOARD_COLUMNS, createPlaceholderAtlas } from "./billboard";
import { configureRetroTexture } from "./renderer";

/**
 * Planches de sprites des ennemis : atlas pré-rendus depuis un modèle 3D
 * animé (`tools/blender/render_enemy_sprites.py`) et le manifeste qui dit
 * quelle ligne porte quelle animation. Ce module traduit l'état d'un ennemi
 * en ligne d'atlas ; `BillboardSprite` choisit la colonne (la direction).
 *
 * Aucune dépendance vers `game/` : l'appelant fournit une `EnemyAnimationInput`
 * déjà traduite depuis la machine à états.
 * see: docs/systems/rendu.md#animation-des-sprites-dennemis
 */

/** Animations d'une planche, mêmes noms que les clés du manifeste. */
export type SpriteAnimationName = "idle" | "alert" | "chase" | "aim" | "fire" | "stagger" | "death";

export interface SpriteAnimation {
  /** Première ligne de l'atlas. */
  row: number;
  frames: number;
  /** Boucle à cadence fixe (`idle`). */
  fps?: number;
  /** Boucle entraînée par la distance parcourue (`chase`) : un Costard bloqué contre un mur cesse de courir. */
  metersPerCycle?: number;
  /** Durée d'affichage après l'évènement (`fire`). */
  duration?: number;
}

export interface EnemySpriteSheet {
  cellWidth: number;
  cellHeight: number;
  rows: number;
  pixelsPerMeter: number;
  /** Pixels transparents sous la ligne des pieds. */
  feetFromBottom: number;
  animations: Record<SpriteAnimationName, SpriteAnimation>;
  /** Une texture par peau ; `humain` existe toujours, `revele` pour le Directeur. */
  atlases: { humain: THREE.Texture } & Record<string, THREE.Texture | undefined>;
}

/**
 * Ce que le rendu doit savoir d'un ennemi pour choisir sa frame. Toutes les
 * durées sont en secondes de GAMEPLAY (hitstop inclus) : un ennemi figé par
 * le hitstop fige aussi son animation.
 */
export interface EnemyAnimationInput {
  pose: "idle" | "alert" | "chase" | "aim" | "stagger" | "death" | "corpse";
  /** Temps passé dans la pose courante. */
  poseTime: number;
  /** Durée prévue de la pose (`alert`, `stagger`, `death`) sur laquelle étaler ses frames ; 0 sinon. */
  poseDuration: number;
  /** Temps depuis l'apparition. */
  clock: number;
  /** Mètres parcourus depuis l'apparition. */
  stride: number;
  timeSinceShot: number;
}

export function createEnemyAnimationInput(): EnemyAnimationInput {
  return { pose: "idle", poseTime: 0, poseDuration: 0, clock: 0, stride: 0, timeSinceShot: Number.POSITIVE_INFINITY };
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

/** Ligne d'atlas de la frame à afficher. Pure, sans allocation. */
export function enemySpriteRow(sheet: EnemySpriteSheet, input: EnemyAnimationInput): number {
  const a = sheet.animations;
  switch (input.pose) {
    case "idle":
      return loopedRow(a.idle, input.clock * (a.idle.fps ?? DEFAULT_IDLE_FPS));
    case "alert":
      return spreadRow(a.alert, input.poseTime, input.poseDuration);
    case "chase":
      // La machine repasse en poursuite le pas même du tir : l'éclair se lit
      // donc par-dessus la course, pendant `fire.duration`.
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

/**
 * Taille du quad et ancrage vertical pour un ennemi dont le rendu interpole
 * le CENTRE de la capsule : la ligne des pieds de l'atlas tombe sur le bas de
 * la capsule. `capsuleBottomBelowCenter` = demi-hauteur + rayon + offset du KCC.
 */
export function enemySpriteQuad(
  sheet: EnemySpriteSheet,
  capsuleBottomBelowCenter: number,
): { width: number; height: number; verticalAnchor: number } {
  const width = sheet.cellWidth / sheet.pixelsPerMeter;
  const height = sheet.cellHeight / sheet.pixelsPerMeter;
  const belowCenter = capsuleBottomBelowCenter + sheet.feetFromBottom / sheet.pixelsPerMeter;
  return { width, height, verticalAnchor: belowCenter / height };
}

// --- Chargement --------------------------------------------------------------

interface SpriteManifest {
  cellWidth: number;
  cellHeight: number;
  columns: number;
  rows: number;
  pixelsPerMeter: number;
  feetFromBottom: number;
  atlases: Record<string, string>;
  animations: Record<string, SpriteAnimation>;
}

const ANIMATION_NAMES: SpriteAnimationName[] = ["idle", "alert", "chase", "aim", "fire", "stagger", "death"];

/**
 * Charge `public/assets/sprites/<name>.json` et ses atlas. Frontière
 * asynchrone : appelée au démarrage, jamais depuis la boucle (invariant #11).
 * Lève si le manifeste ne décrit pas une planche 8 directions complète.
 */
export async function loadEnemySpriteSheet(name: string): Promise<EnemySpriteSheet> {
  const response = await fetch(assetUrl(`assets/sprites/${name}.json`));
  if (!response.ok) throw new Error(`[sprites] ${name}.json : HTTP ${response.status}`);
  const manifest = (await response.json()) as SpriteManifest;

  if (manifest.columns !== BILLBOARD_COLUMNS) {
    throw new Error(`[sprites] ${name}.json : ${manifest.columns} colonnes, le billboard en attend ${BILLBOARD_COLUMNS}`);
  }
  const missing = ANIMATION_NAMES.filter((anim) => !manifest.animations[anim]);
  if (missing.length > 0) throw new Error(`[sprites] ${name}.json : animations manquantes (${missing.join(", ")})`);
  if (!manifest.atlases.humain) throw new Error(`[sprites] ${name}.json : pas de peau "humain"`);

  const loader = new THREE.TextureLoader();
  const entries = await Promise.all(
    Object.entries(manifest.atlases).map(async ([skin, file]) => {
      const texture = await loader.loadAsync(assetUrl(`assets/sprites/${file}`));
      configureRetroTexture(texture);
      return [skin, texture] as const;
    }),
  );
  const atlases = Object.fromEntries(entries) as EnemySpriteSheet["atlases"];

  return {
    cellWidth: manifest.cellWidth,
    cellHeight: manifest.cellHeight,
    rows: manifest.rows,
    pixelsPerMeter: manifest.pixelsPerMeter,
    feetFromBottom: manifest.feetFromBottom,
    animations: manifest.animations as Record<SpriteAnimationName, SpriteAnimation>,
    atlases,
  };
}

/**
 * Planche de repli : l'atlas numéroté historique, une ligne par pose. Sert
 * quand une planche ne se charge pas — le jeu reste jouable, l'erreur est
 * bruyante en console, jamais silencieuse.
 */
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
