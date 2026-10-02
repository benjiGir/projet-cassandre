import { Howl } from "howler";

import { decodeZoneAmbienceManifest, type AmbienceBoxData, type AmbienceZoneData } from "./audioManifest";
import { assetUrl } from "./assetPath";
import { waitForAudioLoad } from "./audioPreparation";
import type { Vec3Like } from "./waterAmbienceMix";

// see: docs/6-reference/notes-code-core.md#adaptateurs-audio

const AMBIANCE_PATH = assetUrl("assets/audio/ambiances");

const BED_VOLUME = 0.25;
const EVENT_VOLUME = 0.25;
const ZONE_FADE_TAU = 0.7;
const BREATH_HZ = 0.045;
const BREATH_DEPTH = 0.12;
const EVENT_GAP: readonly [number, number] = [6, 14];
const EVENT_GAIN_DB: readonly [number, number] = [-4, 2];
const EVENT_PAN = 0.8;
const VOLUME_EPSILON = 0.001;

interface Bed {
  howl: Howl;
  playback: number | null;
  gain: number;
  applied: number;
}

const beds = new Map<string, Bed>();
const events = new Map<string, Howl>();
let zones: Record<string, AmbienceZoneData> = {};
let boxes: { zone: string; box: AmbienceBoxData }[] = [];
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

export function initZoneAmbience(): Promise<void> {
  if (preparation) return preparation;
  preparation = fetch(`${AMBIANCE_PATH}/ambiances.json`, { signal: AbortSignal.timeout(15000) })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(decodeZoneAmbienceManifest)
    .then(async (manifeste) => {
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

function area(box: AmbienceBoxData): number {
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

export function setZoneAmbienceGain(gain: number): void {
  channelGain = gain;
}

export function setZoneAmbienceRandom(next: () => number): void {
  random = next;
}

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

export function zoneAmbienceDebugState(): { zone: string | null; nappes: Record<string, number> } {
  return { zone: currentZone, nappes: Object.fromEntries([...beds].map(([zone, bed]) => [zone, Math.max(bed.applied, 0)])) };
}
