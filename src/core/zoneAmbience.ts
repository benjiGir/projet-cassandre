import { Howl } from "howler";

import { assetUrl } from "./assetPath";
import { waitForAudioLoad } from "./audioPreparation";
import type { Vec3Like } from "./waterAmbienceMix";

/**
 * Ambiances de zone : une nappe en boucle par zone du niveau (magasin, parking,
 * réserve…), et des événements ponctuels tirés au hasard par-dessus. Remplace
 * l'ancienne nappe unique, jugée « trop monotone » et de la mauvaise couleur
 * (2026-10-02). Fichiers et zones : `tools/audio/ia_ambiances.py finalize`.
 *
 * Trois strates (skill `ambience-and-loops`) : la nappe, une respiration lente
 * de son niveau, et un événement toutes les 6 à 14 s, placé à gauche ou à
 * droite. Le passage d'une zone à l'autre se fait en fondu enchaîné.
 *
 * Présentation pure, mise à jour au taux d'affichage (`updateFx`) comme les
 * boucles d'eau : rien ici ne touche au pas fixe. Le tirage passe par un flux
 * `DeterministicRandom` dédié (invariant #12), posé à chaque partie.
 */

const AMBIANCE_PATH = assetUrl("assets/audio/ambiances");

/** Volume de lecture : les fichiers sont à −20 dBFS RMS, la nappe sort vers −32 dBFS. */
const BED_VOLUME = 0.25;
const EVENT_VOLUME = 0.25;
/** Constante de temps du fondu entre zones (s) : un passage de porte s'entend, sans coupure. */
const ZONE_FADE_TAU = 0.7;
const BREATH_HZ = 0.045;
const BREATH_DEPTH = 0.12;
const EVENT_GAP: readonly [number, number] = [6, 14];
const EVENT_GAIN_DB: readonly [number, number] = [-4, 2];
const EVENT_PAN = 0.8;
const VOLUME_EPSILON = 0.001;

interface Box {
  x: [number, number];
  y: [number, number];
  z: [number, number];
}

interface ZoneDef {
  nappe: string;
  /** Région bouclée dans le fichier, en ms : [début, durée] — voir `ia_ambiances.py`, `MARGE_BOUCLE`. */
  boucle: [number, number];
  evenements: string[];
  espaces: Box[];
}

interface AmbianceManifest {
  defaut: string;
  zones: Record<string, ZoneDef>;
}

interface Bed {
  howl: Howl;
  playback: number | null;
  gain: number;
  applied: number;
}

const beds = new Map<string, Bed>();
const events = new Map<string, Howl>();
let zones: Record<string, ZoneDef> = {};
/** Espaces de toutes les zones, du plus petit au plus grand : un couloir l'emporte sur la pièce qu'il borde. */
let boxes: { zone: string; box: Box }[] = [];
let defaultZone: string | null = null;
let currentZone: string | null = null;
let clock = 0;
let nextEventIn = EVENT_GAP[0];
let channelGain = 1;
let random: () => number = () => 0.5;
let preparation: Promise<void> | null = null;

function src(name: string): string[] {
  return [`${AMBIANCE_PATH}/${name}.ogg`, `${AMBIANCE_PATH}/${name}.m4a`];
}

/** Charge le manifeste, les nappes (amorcées en silence) et les événements. Un fichier absent laisse le jeu silencieux, jamais en panne. */
export function initZoneAmbience(): Promise<void> {
  if (preparation) return preparation;
  preparation = fetch(`${AMBIANCE_PATH}/ambiances.json`, { signal: AbortSignal.timeout(15000) })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(async (manifeste: AmbianceManifest) => {
      zones = manifeste.zones;
      defaultZone = manifeste.defaut;
      boxes = Object.entries(zones)
        .flatMap(([zone, def]) => def.espaces.map((box) => ({ zone, box })))
        .sort((a, b) => area(a.box) - area(b.box));
      const loads: Promise<boolean>[] = [];
      for (const [zone, def] of Object.entries(zones)) {
        const bed: Bed = {
          howl: new Howl({
            src: src(def.nappe),
            sprite: { boucle: [def.boucle[0], def.boucle[1], true] },
            volume: 1,
            // Amorcée en silence dès le chargement : un changement de zone ne
            // fait ensuite qu'un fondu de volume, jamais un démarrage.
            onload: () => {
              bed.playback = bed.howl.play("boucle");
              bed.howl.volume(0, bed.playback);
            },
            onloaderror: () => console.warn(`[ambiance] nappe "${def.nappe}" introuvable — zone muette.`),
          }),
          playback: null,
          gain: 0,
          applied: -1,
        };
        beds.set(zone, bed);
        loads.push(waitForAudioLoad(bed.howl));
        for (const name of def.evenements) {
          const howl = new Howl({ src: src(name), volume: EVENT_VOLUME });
          events.set(name, howl);
          loads.push(waitForAudioLoad(howl));
        }
      }
      await Promise.all(loads);
    })
    .catch((e) => {
      console.warn(`[ambiance] manifeste illisible (${e}) — pas d'ambiance de zone.`);
    });
  return preparation;
}

function area(box: Box): number {
  return (box.x[1] - box.x[0]) * (box.z[1] - box.z[0]);
}

function zoneAt(p: Vec3Like): string | null {
  for (const { zone, box } of boxes) {
    if (p.x >= box.x[0] && p.x <= box.x[1] && p.y >= box.y[0] && p.y <= box.y[1] && p.z >= box.z[0] && p.z <= box.z[1]) {
      return zone;
    }
  }
  return null;
}

/** Gain du canal « ambiances » réglé par le joueur (`game/audioSettings.ts`). */
export function setZoneAmbienceGain(gain: number): void {
  channelGain = gain;
}

/** Flux de tirage des événements, remis à chaque partie (`session/lifecycle.ts`). */
export function setZoneAmbienceRandom(next: () => number): void {
  random = next;
}

/**
 * Une frame d'affichage : choisit la zone sous l'auditeur (on garde la
 * précédente entre deux espaces), fond les nappes vers elle, fait respirer
 * leur niveau et lâche un événement quand son tour vient. `active` faux
 * (menus, pause, mort) éteint tout en fondu.
 */
export function updateZoneAmbience(listener: Vec3Like, dt: number, active: boolean): void {
  if (beds.size === 0) return;
  clock += dt;
  currentZone = zoneAt(listener) ?? currentZone ?? defaultZone;

  const breath = 1 + BREATH_DEPTH * Math.sin(2 * Math.PI * BREATH_HZ * clock);
  const k = 1 - Math.exp(-dt / ZONE_FADE_TAU);
  for (const [zone, bed] of beds) {
    const target = active && zone === currentZone ? 1 : 0;
    bed.gain += (target - bed.gain) * k;
    if (bed.playback === null) continue;
    const volume = bed.gain < VOLUME_EPSILON ? 0 : BED_VOLUME * channelGain * bed.gain * breath;
    if (Math.abs(volume - bed.applied) < VOLUME_EPSILON) continue;
    bed.howl.volume(volume, bed.playback);
    bed.applied = volume;
  }

  if (!active || !currentZone) return;
  nextEventIn -= dt;
  if (nextEventIn > 0) return;
  nextEventIn = EVENT_GAP[0] + random() * (EVENT_GAP[1] - EVENT_GAP[0]);
  const names = zones[currentZone]?.evenements ?? [];
  const howl = events.get(names[Math.min(Math.floor(random() * names.length), names.length - 1)] ?? "");
  if (!howl || howl.state() !== "loaded") return;
  const id = howl.play();
  const db = EVENT_GAIN_DB[0] + random() * (EVENT_GAIN_DB[1] - EVENT_GAIN_DB[0]);
  howl.volume(EVENT_VOLUME * channelGain * 10 ** (db / 20), id);
  howl.stereo((random() * 2 - 1) * EVENT_PAN, id);
}

/** Pour la console de debug : la zone entendue et le niveau de chaque nappe. */
export function zoneAmbienceDebugState(): { zone: string | null; nappes: Record<string, number> } {
  return { zone: currentZone, nappes: Object.fromEntries([...beds].map(([zone, bed]) => [zone, Math.max(bed.applied, 0)])) };
}
