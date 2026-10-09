import * as THREE from "three";

import { configureRetroTexture } from "../pipeline/renderer";

// Atlas des taches de sang du gore (`goreSplats.ts`).
// Dessiné par le code, sans tirage : huit formes fixes, gros pixels francs.
// Ligne du haut : taches rondes (sols, plafonds). Ligne du bas : taches à
// coulures (murs), posées coulures vers le bas.

const CELL = 32;
export const ATLAS_COLUMNS = 4;
export const ATLAS_ROWS = 2;
/** Bord transparent de chaque case : les mipmaps n'y mélangent que du vide. */
const MARGIN = 2;

const RIM = [0x4a, 0x0a, 0x0e] as const;
const BODY = [0x8c, 0x12, 0x18] as const;
const CORE = [0x5f, 0x0c, 0x11] as const;
const GLINT = [0xb5, 0x2a, 0x2a] as const;

function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 0x100000000;
}

interface Disc {
  x: number;
  y: number;
  r: number;
}
interface Drip {
  x: number;
  top: number;
  bottom: number;
  halfWidth: number;
}

function splatShapes(variant: number, wall: boolean): { discs: Disc[]; drips: Drip[] } {
  let serial = variant * 1000;
  const next = () => hash(serial++);
  const between = (min: number, max: number) => min + next() * (max - min);
  const discs: Disc[] = [];
  const drips: Drip[] = [];

  const main: Disc = wall
    ? { x: between(14.5, 17.5), y: between(10, 11.5), r: between(5.5, 7) }
    : { x: between(15.5, 16.5), y: between(15.5, 16.5), r: between(7, 8.5) };
  discs.push(main);
  /** Rayon utile de la case : rien ne vient s'y faire couper net par la marge. */
  const reach = wall ? main.y - MARGIN : CELL / 2 - MARGIN - 0.5;

  // Lobes : la tache n'est jamais un disque.
  const lobes = Math.round(between(6, 10));
  for (let i = 0; i < lobes; i++) {
    const angle = between(0, Math.PI * 2);
    const r = between(2.2, 4.5);
    const distance = Math.min(main.r * between(0.7, 1.15), reach - r);
    discs.push({ x: main.x + Math.cos(angle) * distance, y: main.y + Math.sin(angle) * distance, r });
  }

  // Gouttes projetées, alignées par deux ou trois sur un même rayon.
  const rays = Math.round(between(4, 7));
  for (let i = 0; i < rays; i++) {
    const angle = wall ? between(Math.PI, Math.PI * 2) : between(0, Math.PI * 2);
    let distance = main.r + between(1.5, 2.5);
    const drops = Math.round(between(1, 3));
    for (let j = 0; j < drops; j++) {
      const r = between(0.8, 1.5);
      if (distance + r > reach) break;
      discs.push({ x: main.x + Math.cos(angle) * distance, y: main.y + Math.sin(angle) * distance, r });
      distance += between(1.8, 2.6);
    }
  }

  if (wall) {
    const count = Math.round(between(2, 4));
    for (let i = 0; i < count; i++) {
      const x = Math.round(main.x + between(-main.r, main.r) * 0.9);
      const bottom = between(main.y + 8, CELL - MARGIN - 2);
      const halfWidth = i === 0 ? 1 : 0.5;
      drips.push({ x: x + (halfWidth === 1 ? 0 : 0.5), top: main.y, bottom, halfWidth });
      discs.push({ x: x + (halfWidth === 1 ? 0 : 0.5), y: bottom, r: between(1.1, 1.7) });
    }
  }
  return { discs, drips };
}

export function createSplatAtlas(): THREE.DataTexture {
  const width = CELL * ATLAS_COLUMNS;
  const height = CELL * ATLAS_ROWS;
  const data = new Uint8Array(width * height * 4);
  // Le vide porte la couleur du sang : pas de liseré sombre au bord des taches réduites.
  for (let i = 0; i < width * height; i++) data.set(BODY, i * 4);

  for (let row = 0; row < ATLAS_ROWS; row++) {
    for (let column = 0; column < ATLAS_COLUMNS; column++) {
      const variant = row * ATLAS_COLUMNS + column;
      const { discs, drips } = splatShapes(variant, row === 1);
      for (let py = MARGIN; py < CELL - MARGIN; py++) {
        for (let px = MARGIN; px < CELL - MARGIN; px++) {
          const x = px + 0.5;
          const y = py + 0.5;
          let depth = -1;
          for (const disc of discs) depth = Math.max(depth, disc.r - Math.hypot(x - disc.x, y - disc.y));
          for (const drip of drips) {
            if (y >= drip.top && y <= drip.bottom && Math.abs(x - drip.x) <= drip.halfWidth)
              depth = Math.max(depth, 1.2);
          }
          if (depth < 0) continue;
          let color: readonly number[] = depth < 0.8 ? RIM : depth > 3.2 ? CORE : BODY;
          if (color === BODY && hash(variant * 4096 + py * 64 + px) < 0.07) color = GLINT;
          // Image écrite de haut en bas ; la texture, elle, part du bas.
          const dataRow = (ATLAS_ROWS - 1 - row) * CELL + (CELL - 1 - py);
          const offset = (dataRow * width + column * CELL + px) * 4;
          data.set(color, offset);
          data[offset + 3] = 255;
        }
      }
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  configureRetroTexture(texture);
  return texture;
}
