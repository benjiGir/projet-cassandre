import * as THREE from "three";
import { assetUrl } from "../../core/loading/assetPath";
import { fetchJson } from "../../core/net/fetchJson";
import { configureRetroTexture } from "../pipeline/renderer";
import type { HeroAsset, HeroAtlas, HeroAtlasKind, HeroSpriteFrame } from "./heroTypes";

interface AtlasData {
  readonly file: string;
  readonly width: number;
  readonly height: number;
  readonly frames: readonly (readonly HeroSpriteFrame[])[];
}

function object(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") throw new Error("[héros] manifeste invalide");
  return raw as Record<string, unknown>;
}

function positive(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) throw new Error("[héros] dimension invalide");
  return raw;
}

function nonNegative(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) throw new Error("[héros] origine invalide");
  return raw;
}

function decodeAtlas(raw: unknown, rows = 4): AtlasData {
  const data = object(raw);
  const width = positive(data.width);
  const height = positive(data.height);
  if (typeof data.file !== "string" || !/^hero-[a-z-]+\.png$/.test(data.file))
    throw new Error("[héros] atlas invalide");
  if (!Array.isArray(data.frames) || data.frames.length !== rows) throw new Error("[héros] nombre de poses invalide");
  const frames = data.frames.map((row: unknown) => {
    if (!Array.isArray(row) || row.length !== 8) throw new Error("[héros] huit directions attendues");
    return row.map((rawFrame: unknown): HeroSpriteFrame => {
      const frame = object(rawFrame);
      const x = nonNegative(frame.x);
      const y = nonNegative(frame.y);
      const w = positive(frame.width);
      const h = positive(frame.height);
      const anchorX = positive(frame.anchorX);
      if (x + w > width || y + h > height || anchorX > w) throw new Error("[héros] case hors atlas");
      return { x, y, width: w, height: h, anchorX };
    });
  });
  return { file: data.file, width, height, frames };
}

function decodeManifest(raw: unknown): Record<HeroAtlasKind, AtlasData> {
  const data = object(raw);
  return {
    locomotion: decodeAtlas(data.locomotion),
    equipment: decodeAtlas(data.equipment),
    actions: decodeAtlas(data.actions),
    armedWalk: decodeAtlas(data.armedWalk, 7),
  };
}

export async function loadHero(): Promise<HeroAsset> {
  const data = await fetchJson(assetUrl("assets/characters/hero.json"), decodeManifest);
  const loader = new THREE.TextureLoader();
  const kinds = ["locomotion", "equipment", "actions", "armedWalk"] as const;
  const results = await Promise.allSettled(
    kinds.map(async (kind): Promise<HeroAtlas> => {
      const atlas = data[kind];
      const texture = await loader.loadAsync(assetUrl(`assets/characters/${atlas.file}`));
      configureRetroTexture(texture);
      return { texture, width: atlas.width, height: atlas.height, frames: atlas.frames };
    }),
  );
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") {
    for (const result of results) if (result.status === "fulfilled") result.value.texture.dispose();
    throw failed.reason;
  }
  const atlas = (index: number): HeroAtlas => {
    const result = results[index];
    if (result.status !== "fulfilled") throw new Error("[héros] chargement incomplet");
    return result.value;
  };
  return { atlases: { locomotion: atlas(0), equipment: atlas(1), actions: atlas(2), armedWalk: atlas(3) } };
}
