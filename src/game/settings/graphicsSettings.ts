import type * as THREE from "three";

import {
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
  appliquerFiltrage,
  setResolutionInterne,
  type FiltrageTexture,
} from "../../render/pipeline/renderer";
import { moveConfig } from "../player/movement/moveConfig";
import { weaponConfig } from "../player/weapons/weaponConfig";

// see: docs/6-reference/notes-code-gameplay-outils.md#réglages

export type ResolutionPresetId = "origine" | "x1.5" | "x2" | "x2.5";

export interface ResolutionPreset {
  id: ResolutionPresetId;
  width: number;
  height: number;
  /** Libellé humain, présente toujours 640×360 comme L'ORIGINE, jamais comme une valeur basse à corriger (invariant #4). */
  label: string;
}

export const RESOLUTION_PRESETS: readonly ResolutionPreset[] = [
  {
    id: "origine",
    width: INTERNAL_WIDTH,
    height: INTERNAL_HEIGHT,
    label: `${INTERNAL_WIDTH}×${INTERNAL_HEIGHT} — résolution d'origine du jeu`,
  },
  {
    id: "x1.5",
    width: INTERNAL_WIDTH * 1.5,
    height: INTERNAL_HEIGHT * 1.5,
    label: `${INTERNAL_WIDTH * 1.5}×${INTERNAL_HEIGHT * 1.5}`,
  },
  {
    id: "x2",
    width: INTERNAL_WIDTH * 2,
    height: INTERNAL_HEIGHT * 2,
    label: `${INTERNAL_WIDTH * 2}×${INTERNAL_HEIGHT * 2}`,
  },
  {
    id: "x2.5",
    width: INTERNAL_WIDTH * 2.5,
    height: INTERNAL_HEIGHT * 2.5,
    label: `${INTERNAL_WIDTH * 2.5}×${INTERNAL_HEIGHT * 2.5}`,
  },
];

export interface GraphicsSettings {
  filtrage: FiltrageTexture;
  resolution: ResolutionPresetId;
  /** Degrés. Valeur de BASE (`moveConfig.fovBase`) — l'élargissement à la course (`fovRunBoost`) s'ajoute par-dessus, inchangé. */
  fovBase: number;
  /** 0 (aucun screenshake) à 1 (intensité d'origine, `SHAKE_SCALE_MAX`). Un seul curseur pour toutes les amplitudes de `weaponConfig`. */
  shakeIntensity: number;
}

const STORAGE_KEY = "cassandre.graphics";

/** 0 = aucun screenshake, 1 = intensité d'origine (celle déjà tunée dans `weaponConfig.ts`). Le curseur ne va jamais au-delà. */
const SHAKE_SCALE_MAX = 1;

const FACTORY_DEFAULTS: GraphicsSettings = {
  filtrage: "aniso",
  resolution: "origine",
  fovBase: moveConfig.fovBase,
  shakeIntensity: SHAKE_SCALE_MAX,
};

const FACTORY_SHAKE_AMPLITUDES = {
  shakeAmplitude: weaponConfig.shakeAmplitude,
  enemyShakeAmplitude: weaponConfig.enemyShakeAmplitude,
};

function isFiltrage(value: unknown): value is FiltrageTexture {
  return value === "nearest" || value === "mipmap" || value === "aniso";
}

function isResolutionId(value: unknown): value is ResolutionPresetId {
  return RESOLUTION_PRESETS.some((p) => p.id === value);
}

/** Ne throw jamais, dégrade sur les valeurs d'origine — même discipline que `core/input/input.ts`. */
function loadPersisted(): GraphicsSettings {
  if (typeof localStorage === "undefined") return { ...FACTORY_DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...FACTORY_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<GraphicsSettings>;
    return {
      filtrage: isFiltrage(parsed.filtrage) ? parsed.filtrage : FACTORY_DEFAULTS.filtrage,
      resolution: isResolutionId(parsed.resolution) ? parsed.resolution : FACTORY_DEFAULTS.resolution,
      fovBase:
        typeof parsed.fovBase === "number" && Number.isFinite(parsed.fovBase)
          ? parsed.fovBase
          : FACTORY_DEFAULTS.fovBase,
      shakeIntensity:
        typeof parsed.shakeIntensity === "number" && Number.isFinite(parsed.shakeIntensity)
          ? Math.max(0, Math.min(SHAKE_SCALE_MAX, parsed.shakeIntensity))
          : FACTORY_DEFAULTS.shakeIntensity,
    };
  } catch {
    return { ...FACTORY_DEFAULTS };
  }
}

function savePersisted(settings: GraphicsSettings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Dégrade silencieusement, même discipline que `core/input/input.ts`.
  }
}

let current: GraphicsSettings = loadPersisted();

export function getGraphicsSettings(): GraphicsSettings {
  return current;
}

export function getFactoryDefaults(): GraphicsSettings {
  return { ...FACTORY_DEFAULTS };
}

/** FOV de base + intensité du screenshake : aucun des deux n'a besoin d'un moteur construit, voir la doc de tête. */
function applyNonRenderSettings(settings: GraphicsSettings): void {
  moveConfig.fovBase = settings.fovBase;
  weaponConfig.shakeAmplitude = FACTORY_SHAKE_AMPLITUDES.shakeAmplitude * settings.shakeIntensity;
  weaponConfig.enemyShakeAmplitude = FACTORY_SHAKE_AMPLITUDES.enemyShakeAmplitude * settings.shakeIntensity;
}

export function applyRenderSettings(
  settings: GraphicsSettings,
  scene: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
): void {
  appliquerFiltrage(scene, settings.filtrage);
  const preset = RESOLUTION_PRESETS.find((p) => p.id === settings.resolution) ?? RESOLUTION_PRESETS[0];
  setResolutionInterne(renderer, camera, preset.width, preset.height);
}

interface RenderTarget {
  scene: THREE.Object3D;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

/** `null` tant qu'aucun moteur n'est construit (menu principal, avant `buildGameEngine`) — voir `registerRenderTarget`. */
let renderTarget: RenderTarget | null = null;

export function registerRenderTarget(
  scene: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
): void {
  renderTarget = { scene, camera, renderer };
  applyRenderSettings(current, scene, camera, renderer);
}

export function initGraphicsSettingsAtBoot(): GraphicsSettings {
  current = loadPersisted();
  applyNonRenderSettings(current);
  return current;
}

export function setGraphicsSettings(partial: Partial<GraphicsSettings>): GraphicsSettings {
  current = { ...current, ...partial };
  savePersisted(current);
  applyNonRenderSettings(current);
  if (renderTarget) applyRenderSettings(current, renderTarget.scene, renderTarget.camera, renderTarget.renderer);
  return current;
}

export function resetGraphicsSettings(): GraphicsSettings {
  return setGraphicsSettings(FACTORY_DEFAULTS);
}
