import * as THREE from "three";

import {
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
  appliquerFiltrage,
  setResolutionInterne,
  type FiltrageTexture,
} from "../render/renderer";
import { moveConfig } from "./player/moveConfig";
import { weaponConfig } from "./player/weaponConfig";

/**
 * Réglages graphiques et visuels — écran « Options › Affichage »
 * (`ui/screens/options/display/DisplayTab/DisplayTab.tsx`, qui ne fait que les présenter). Ce
 * module persiste (`localStorage`) et applique ; il vit hors de `src/ui/`
 * parce qu'il pilote le moteur. N'IMPLÉMENTE aucun des quatre réglages
 * lui-même — il APPELLE les fonctions déjà exportées de `render/renderer.ts`
 * et mute les objets déjà mutables de `moveConfig.ts`/`weaponConfig.ts`.
 *
 * **Pourquoi le filtrage de texture est le réglage qui compte le plus ici** :
 * c'est l'amendement de l'invariant #4 proposé par l'ADR 0027, EN ATTENTE DE
 * VALIDATION depuis le 2026-09-13 parce que trancher demandait jusqu'ici un
 * appel console (`cassandre.filtrage(...)`). Ce menu ne fait rien de neuf
 * côté rendu — il donne juste un accès humain, sans console, à un réglage
 * qui existe déjà.
 *
 * **Les quatre réglages s'appliquent à chaud EN JEU, depuis la pause**
 * (`ui/screens/pause/PauseScreen/PauseScreen.tsx`, qui réutilise
 * `OptionsScreen` tel quel — voir `docs/systems/session.md#pause`).
 * `registerRenderTarget(scene, camera, renderer)`, appelée UNE FOIS par
 * `main.ts` juste après `buildGameEngine`, retient la scène/caméra/renderer
 * VIVANTS pour le reste de l'onglet (ils ne sont jamais reconstruits par un
 * "Rejouer"/"Retour au menu", voir `docs/systems/session.md#létat-persistant-du-process-gameengine`) :
 * `setGraphicsSettings` applique alors le filtrage/la résolution
 * IMMÉDIATEMENT dès qu'une cible est enregistrée, en plus de les persister.
 * **Avant** cet enregistrement — au tout premier menu principal, avant que le
 * moteur existe — un changement reste PERSISTÉ SEULEMENT, repris au prochain
 * boot (`initGraphicsSettingsAtBoot`). Le FOV et le screenshake, eux, sont de
 * simples champs mutables lus en continu par le jeu (`moveConfig.fovBase` à
 * chaque frame dans `interpolateVisuals`, `weaponConfig.shakeAmplitude` à
 * chaque déclenchement de secousse) : les muter s'applique immédiatement,
 * qu'un moteur existe ou non, qu'un niveau soit chargé ou non.
 *
 * **Pourquoi le filtrage survit à un rechargement de niveau sans code
 * dédié** : `game/level/loader.ts::toLambert` appelle
 * `configureRetroTexture(texture)` SANS second argument, qui retombe sur le
 * mode COURANT du module `render/renderer.ts` (`filtrage`, muté par
 * `appliquerFiltrage`). Une fois posé une première fois (au boot), ce mode
 * reste actif pour CHAQUE texture créée ensuite — premier chargement,
 * `replay()`, hot reload — sans qu'aucun de ces chemins n'ait besoin
 * d'appeler ce module à nouveau.
 */

export type ResolutionPresetId = "origine" | "x1.5" | "x2" | "x2.5";

export interface ResolutionPreset {
  id: ResolutionPresetId;
  width: number;
  height: number;
  /** Libellé humain, présente toujours 640×360 comme L'ORIGINE, jamais comme une valeur basse à corriger (invariant #4). */
  label: string;
}

export const RESOLUTION_PRESETS: readonly ResolutionPreset[] = [
  { id: "origine", width: INTERNAL_WIDTH, height: INTERNAL_HEIGHT, label: `${INTERNAL_WIDTH}×${INTERNAL_HEIGHT} — résolution d'origine du jeu` },
  { id: "x1.5", width: INTERNAL_WIDTH * 1.5, height: INTERNAL_HEIGHT * 1.5, label: `${INTERNAL_WIDTH * 1.5}×${INTERNAL_HEIGHT * 1.5}` },
  { id: "x2", width: INTERNAL_WIDTH * 2, height: INTERNAL_HEIGHT * 2, label: `${INTERNAL_WIDTH * 2}×${INTERNAL_HEIGHT * 2}` },
  { id: "x2.5", width: INTERNAL_WIDTH * 2.5, height: INTERNAL_HEIGHT * 2.5, label: `${INTERNAL_WIDTH * 2.5}×${INTERNAL_HEIGHT * 2.5}` },
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

/**
 * Valeurs d'ORIGINE, capturées une seule fois au chargement de ce module —
 * AVANT toute application d'un réglage persisté. Sert de base à l'échelle du
 * screenshake (`shakeIntensity` est un multiplicateur DE CES valeurs, jamais
 * cumulatif) et de valeur de retour pour "Réinitialiser". Ne jamais lire
 * `moveConfig`/`weaponConfig` à nouveau pour ça une fois ce module chargé :
 * ils peuvent déjà avoir été mutés par un réglage persisté ou par
 * `TuningPanel`.
 */
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

/** Ne throw jamais, dégrade sur les valeurs d'origine — même discipline que `core/input.ts`/`core/music.ts`. */
function loadPersisted(): GraphicsSettings {
  if (typeof localStorage === "undefined") return { ...FACTORY_DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...FACTORY_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<GraphicsSettings>;
    return {
      filtrage: isFiltrage(parsed.filtrage) ? parsed.filtrage : FACTORY_DEFAULTS.filtrage,
      resolution: isResolutionId(parsed.resolution) ? parsed.resolution : FACTORY_DEFAULTS.resolution,
      fovBase: typeof parsed.fovBase === "number" && Number.isFinite(parsed.fovBase) ? parsed.fovBase : FACTORY_DEFAULTS.fovBase,
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
    // Dégrade silencieusement, même discipline que `core/input.ts`.
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

/**
 * Filtrage + résolution interne. Demande une `scene` (même vide : c'est
 * aussi ce qui pose le mode par défaut pour tout futur chargement de
 * niveau, voir la doc de tête) et un couple caméra/renderer déjà construits
 * — donc seulement appelable une fois `buildGameEngine` passé (`main.ts`),
 * jamais depuis l'écran de réglages lui-même (qui passe par
 * `setGraphicsSettings`/`registerRenderTarget` ci-dessous).
 */
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

/**
 * Enregistre la scène/caméra/renderer VIVANTS du moteur — appelée UNE FOIS
 * par `main.ts`, juste après `buildGameEngine`. Applique aussitôt le
 * réglage courant (comme le faisait l'ancien appel explicite à
 * `applyRenderSettings` dans `main.ts`), puis reste la cible de tout futur
 * `setGraphicsSettings` pour le reste de l'onglet — y compris pendant une
 * partie, en pause (voir la doc de tête).
 */
export function registerRenderTarget(scene: THREE.Object3D, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer): void {
  renderTarget = { scene, camera, renderer };
  applyRenderSettings(current, scene, camera, renderer);
}

/**
 * Appelée UNE FOIS, tout en haut de `main()`, avant même le menu principal —
 * charge le réglage persisté et applique immédiatement ce qui peut l'être
 * sans moteur construit (FOV, screenshake). Retourne le réglage chargé pour
 * que `main.ts` puisse appliquer le reste (filtrage, résolution) via
 * `registerRenderTarget` une fois `scene`/`camera`/`renderer` prêts.
 */
export function initGraphicsSettingsAtBoot(): GraphicsSettings {
  current = loadPersisted();
  applyNonRenderSettings(current);
  return current;
}

/**
 * Appelée par l'écran de réglages à chaque interaction humaine (jamais par
 * frame — invariant #2). Persiste toujours ; applique immédiatement le FOV
 * et le screenshake (aucun moteur requis) ; applique aussi immédiatement le
 * filtrage/la résolution SI une cible est enregistrée (voir
 * `registerRenderTarget`) — sinon persister suffit,
 * `initGraphicsSettingsAtBoot`/`registerRenderTarget` les reprendront au
 * prochain boot.
 */
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
