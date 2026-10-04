/**
 * Gore (`render/fx/gore.ts`) : ce qu'un ennemi laisse sur le décor. Le décor
 * est ici une sonde de test — un sol à y = 0 et un mur à x = 4 — sans Rapier.
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { Gore } from "../../../src/render/fx/gore";
import { goreConfig, type SurfaceHit, type SurfaceProbe } from "../../../src/render/fx/goreConfig";

/** Petit générateur déterministe, local au test. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

interface Plane { point: THREE.Vector3; normal: THREE.Vector3; inside?: (p: THREE.Vector3) => boolean }

function probeOf(planes: readonly Plane[]): SurfaceProbe {
  return (origin, direction, maxDistance) => {
    let best: SurfaceHit | null = null;
    let bestDistance = maxDistance;
    for (const plane of planes) {
      const facing = direction.dot(plane.normal);
      if (facing >= -1e-6) continue;
      const distance = plane.point.clone().sub(origin).dot(plane.normal) / facing;
      if (distance <= 1e-4 || distance > bestDistance) continue;
      const point = origin.clone().addScaledVector(direction, distance);
      if (plane.inside && !plane.inside(point)) continue;
      best = { point, normal: plane.normal.clone() };
      bestDistance = distance;
    }
    return best;
  };
}

const FLOOR: Plane = { point: new THREE.Vector3(0, 0, 0), normal: new THREE.Vector3(0, 1, 0) };
const WALL: Plane = { point: new THREE.Vector3(4, 0, 0), normal: new THREE.Vector3(-1, 0, 0) };
const ROOM = probeOf([FLOOR, WALL]);

function goreWith(probe: SurfaceProbe | null, seed = 3) {
  const scene = new THREE.Scene();
  const gore = new Gore(scene, rng(seed));
  gore.setSurfaceProbe(probe);
  return { scene, gore };
}

function settle(gore: Gore, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) gore.update(1 / 60);
}

/** Positions des quatre coins de chaque tache posée. */
function splatCorners(scene: THREE.Scene): THREE.Vector3[][] {
  const mesh = scene.children.find((child) => child instanceof THREE.Mesh && !(child instanceof THREE.InstancedMesh)) as THREE.Mesh;
  const position = mesh.geometry.getAttribute("position");
  const quads: THREE.Vector3[][] = [];
  for (let i = 0; i < position.count; i += 4) {
    const corners = [0, 1, 2, 3].map((c) => new THREE.Vector3().fromBufferAttribute(position, i + c));
    if (corners[0]!.distanceTo(corners[2]!) > 1e-6) quads.push(corners);
  }
  return quads;
}

describe("gore — un ennemi qui explose", () => {
  it("laisse du sang au sol ET au mur, et ses morceaux retombent et restent", () => {
    const { scene, gore } = goreWith(ROOM);

    gore.spawnGibs(new THREE.Vector3(2.5, 1.2, 0), new THREE.Vector3(1, 0, 0));
    expect(gore.flyingChunkCount).toBe(goreConfig.gibChunks);
    settle(gore, 4);

    expect(gore.flyingChunkCount).toBe(0);
    expect(gore.restingChunkCount).toBe(goreConfig.gibChunks);
    const quads = splatCorners(scene);
    const onFloor = quads.filter((q) => q.every((c) => Math.abs(c.y - goreConfig.surfaceOffset) < 1e-4));
    const onWall = quads.filter((q) => q.every((c) => Math.abs(c.x - (4 - goreConfig.surfaceOffset)) < 1e-4));
    expect(onFloor.length).toBeGreaterThan(3);
    expect(onWall.length).toBeGreaterThan(1);
    expect(onFloor.length + onWall.length).toBe(quads.length);
    expect(gore.splatCount).toBe(quads.length);
  });

  it("ne coûte que deux lots de dessin, quelle que soit la quantité de sang", () => {
    const { scene, gore } = goreWith(ROOM);
    const before = scene.children.length;
    for (let i = 0; i < 6; i++) gore.spawnGibs(new THREE.Vector3(2, 1.2, i), new THREE.Vector3(1, 0, 0));
    settle(gore, 4);
    expect(before).toBe(2);
    expect(scene.children.length).toBe(2);
  });

  it("reprend les plus anciens quand la réserve est pleine", () => {
    const { gore } = goreWith(ROOM);
    for (let i = 0; i < 40; i++) {
      gore.spawnGibs(new THREE.Vector3(2, 1.2, i * 0.5), new THREE.Vector3(1, 0, 0));
      settle(gore, 2);
    }
    expect(gore.splatCount).toBe(goreConfig.splatCapacity);
    expect(gore.restingChunkCount).toBe(goreConfig.chunkCapacity);
  });

  it("sans décor à portée, rien ne se pose : les morceaux tombent et disparaissent", () => {
    const { gore } = goreWith(null);
    gore.spawnGibs(new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(1, 0, 0));
    settle(gore, goreConfig.chunkMaxFlight + 0.5);
    expect(gore.splatCount).toBe(0);
    expect(gore.flyingChunkCount).toBe(0);
    expect(gore.restingChunkCount).toBe(0);
  });
});

describe("gore — taches", () => {
  it("la flaque d'un mort s'étale : petite d'abord, à sa taille ensuite", () => {
    const { scene, gore } = goreWith(ROOM);
    gore.spawnPool(new THREE.Vector3(0, 0.9, 0));

    const width = () => {
      const [quad] = splatCorners(scene);
      return quad![0]!.distanceTo(quad![1]!);
    };
    const start = width();
    settle(gore, goreConfig.deathPoolGrow + 0.2);
    const end = width();

    expect(gore.splatCount).toBe(1);
    expect(start).toBeLessThan(end * 0.5);
    expect(end).toBeGreaterThanOrEqual(goreConfig.deathPoolSize[0]);
    expect(end).toBeLessThanOrEqual(goreConfig.deathPoolSize[1]);
  });

  it("un ennemi touché saigne sur le mur derrière lui, à défaut sur le sol", () => {
    const { scene, gore } = goreWith(ROOM);
    gore.spawnSpray(new THREE.Vector3(2, 1.2, 0), new THREE.Vector3(1, 0, 0), "pistol");
    gore.spawnSpray(new THREE.Vector3(-20, 1.2, 0), new THREE.Vector3(1, 0, 0), "pistol");

    const [wall, floor] = splatCorners(scene);
    expect(wall!.every((c) => Math.abs(c.x - (4 - goreConfig.surfaceOffset)) < 1e-4)).toBe(true);
    expect(floor!.every((c) => Math.abs(c.y - goreConfig.surfaceOffset) < 1e-4)).toBe(true);
    // Au mur, la tache est droite : ses coulures descendent.
    expect(wall![3]!.y - wall![0]!.y).toBeGreaterThan(0.2);
    expect(Math.abs(wall![1]!.y - wall![0]!.y)).toBeLessThan(1e-6);
  });

  it("ne dépasse pas d'une arête : réduite près du bord, refusée au bord", () => {
    const ledge = probeOf([{ ...FLOOR, inside: (p) => p.x <= 0 }]);
    const { scene, gore } = goreWith(ledge);

    gore.spawnPool(new THREE.Vector3(-0.35, 1, 0));
    settle(gore, 2);
    const [reduced] = splatCorners(scene);
    expect(reduced![0]!.distanceTo(reduced![1]!)).toBeLessThan(goreConfig.deathPoolSize[0]);

    gore.spawnPool(new THREE.Vector3(-0.05, 1, 0));
    expect(gore.splatCount).toBe(1);
  });

  it("une nouvelle partie repart d'un décor propre", () => {
    const { scene, gore } = goreWith(ROOM);
    gore.spawnGibs(new THREE.Vector3(2.5, 1.2, 0), new THREE.Vector3(1, 0, 0));
    settle(gore, 3);

    gore.reset();

    expect(gore.splatCount).toBe(0);
    expect(gore.restingChunkCount).toBe(0);
    expect(splatCorners(scene)).toEqual([]);
  });
});
