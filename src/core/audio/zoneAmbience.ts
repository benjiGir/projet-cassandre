import { Howl } from "howler";

import { decodeZoneAmbienceManifest, type AmbienceBoxData, type AmbienceZoneData } from "./audioManifest";
import { assetUrl } from "../loading/assetPath";
import { waitForAudioLoad } from "./audioPreparation";
import type { Vec3Like } from "./waterAmbienceMix";

// see: docs/6-reference/notes-code-core.md#adaptateurs-audio

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
  started: boolean;
  gain: number;
  applied: number;
}

interface PreparedProfile {
  beds: Map<string, Bed>;
  events: Map<string, Howl>;
  zones: Record<string, AmbienceZoneData>;
  boxes: { zone: string; box: AmbienceBoxData }[];
  defaultZone: string;
}

let beds = new Map<string, Bed>();
let events = new Map<string, Howl>();
let zones: Record<string, AmbienceZoneData> = {};
let boxes: { zone: string; box: AmbienceBoxData }[] = [];
let defaultZone: string | null = null;
let currentZone: string | null = null;
let clock = 0;
let nextEventIn = EVENT_GAP[0];
let channelGain = 1;
let random: () => number = () => 0.5;
const preparations = new Map<string, Promise<PreparedProfile | null>>();
let selectionGeneration = 0;
let currentProfile = "ambiances";

function prepareProfile(profile: string): Promise<PreparedProfile | null> {
  const path = assetUrl(`assets/audio/${profile}`);
  const src = (name: string) => [`${path}/${name}.ogg`, `${path}/${name}.m4a`];
  return fetch(`${path}/ambiances.json`, { signal: AbortSignal.timeout(15000) })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(decodeZoneAmbienceManifest)
    .then(async (manifeste) => {
      const profileBeds = new Map<string, Bed>();
      const profileEvents = new Map<string, Howl>();
      const profileBoxes = Object.entries(manifeste.zones)
        .flatMap(([zone, def]) => def.espaces.map((box) => ({ zone, box })))
        .sort((a, b) => area(a.box) - area(b.box));
      const loads: Promise<boolean>[] = [];
      for (const [zone, def] of Object.entries(manifeste.zones)) {
        const bed: Bed = {
          howl: new Howl({
            src: src(def.nappe),
            sprite: { boucle: [def.boucle[0], def.boucle[1], true] },
            volume: 0,
            onload: () => {
              bed.playback = bed.howl.play("boucle");
            },
            onplay: () => {
              bed.started = true;
            },
            onloaderror: () => console.warn(`[ambiance] nappe "${def.nappe}" introuvable — zone muette.`),
          }),
          playback: null,
          started: false,
          gain: 0,
          applied: -1,
        };
        profileBeds.set(zone, bed);
        loads.push(waitForAudioLoad(bed.howl));
        for (const name of def.evenements) {
          if (profileEvents.has(name)) continue;
          const howl = new Howl({ src: src(name), volume: EVENT_VOLUME });
          profileEvents.set(name, howl);
          loads.push(waitForAudioLoad(howl));
        }
      }
      await Promise.all(loads);
      return {
        beds: profileBeds,
        events: profileEvents,
        zones: manifeste.zones,
        boxes: profileBoxes,
        defaultZone: manifeste.defaut,
      };
    })
    .catch((e) => {
      console.warn(`[ambiance] profil ${profile} illisible (${e}) — pas d'ambiance de zone.`);
      return null;
    });
}

// see: docs/4-technique/pilote-metro.md#ambiances-par-niveau
export async function initZoneAmbience(profile = "ambiances"): Promise<void> {
  const generation = ++selectionGeneration;
  let prepared = preparations.get(profile);
  if (!prepared) {
    prepared = prepareProfile(profile);
    preparations.set(profile, prepared);
  }
  const loaded = await prepared;
  if (generation !== selectionGeneration) return;
  clearZoneAmbienceSession();
  currentProfile = profile;
  beds = loaded?.beds ?? new Map();
  events = loaded?.events ?? new Map();
  zones = loaded?.zones ?? {};
  boxes = loaded?.boxes ?? [];
  defaultZone = loaded?.defaultZone ?? null;
  clearZoneAmbienceSession();
}

function area(box: AmbienceBoxData): number {
  return (box.x[1] - box.x[0]) * (box.z[1] - box.z[0]);
}

function zoneAt(p: Vec3Like): string | null {
  for (const { zone, box } of boxes) {
    if (
      p.x >= box.x[0] &&
      p.x <= box.x[1] &&
      p.y >= box.y[0] &&
      p.y <= box.y[1] &&
      p.z >= box.z[0] &&
      p.z <= box.z[1]
    ) {
      return zone;
    }
  }
  return null;
}

export function setZoneAmbienceGain(gain: number): void {
  channelGain = gain;
}

function clearZoneAmbienceSession(): void {
  clock = 0;
  nextEventIn = EVENT_GAP[0];
  currentZone = null;
  for (const howl of events.values()) howl.stop();
  for (const bed of beds.values()) {
    bed.gain = 0;
    bed.applied = 0;
    // Garder la boucle préchargée ; seule son enveloppe appartient à la partie.
    if (bed.started && bed.playback !== null && bed.howl.playing(bed.playback)) bed.howl.volume(0, bed.playback);
  }
}

export function resetZoneAmbienceSession(next: () => number): void {
  clearZoneAmbienceSession();
  random = next;
}

export function stopZoneAmbienceSession(): void {
  clearZoneAmbienceSession();
  random = () => 0.5;
}

export function updateZoneAmbience(listener: Vec3Like, dt: number, active: boolean): void {
  if (beds.size === 0) return;
  if (active) {
    clock += dt;
    currentZone = zoneAt(listener) ?? currentZone ?? defaultZone;
  }

  const breath = 1 + BREATH_DEPTH * Math.sin(2 * Math.PI * BREATH_HZ * clock);
  const k = 1 - Math.exp(-dt / ZONE_FADE_TAU);
  for (const [zone, bed] of beds) {
    const target = active && zone === currentZone ? 1 : 0;
    bed.gain += (target - bed.gain) * k;
    // Howler empile les volumes tant que le contexte attend le geste utilisateur.
    if (!bed.started || bed.playback === null || !bed.howl.playing(bed.playback)) continue;
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

export function zoneAmbienceDebugState(): {
  profil: string;
  zone: string | null;
  nappes: Record<string, number>;
  horloge: number;
  prochainEvenementDans: number;
} {
  return {
    profil: currentProfile,
    zone: currentZone,
    nappes: Object.fromEntries([...beds].map(([zone, bed]) => [zone, Math.max(bed.applied, 0)])),
    horloge: clock,
    prochainEvenementDans: nextEventIn,
  };
}
