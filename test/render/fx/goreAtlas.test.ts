/**
 * Atlas des taches de sang (`render/fx/goreAtlas.ts`) : dessiné par le code,
 * sans tirage.
 */
import { describe, expect, it } from "vitest";

import { ATLAS_COLUMNS, ATLAS_ROWS, createSplatAtlas } from "../../../src/render/fx/goreAtlas";

const CELL = 32;

function pixels() {
  const { data, width, height } = createSplatAtlas().image as { data: Uint8Array; width: number; height: number };
  return { data, width, height };
}

/** Pixels opaques d'une case, en coordonnées de la case. */
function opaque(column: number, row: number): string[] {
  const { data, width } = pixels();
  const out: string[] = [];
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (data[((row * CELL + y) * width + column * CELL + x) * 4 + 3] === 255) out.push(`${x},${y}`);
    }
  }
  return out;
}

describe("atlas des taches", () => {
  it("a huit cases, et ne dépend d'aucun tirage : deux créations rendent la même image", () => {
    const { width, height } = pixels();
    expect([width, height]).toEqual([CELL * ATLAS_COLUMNS, CELL * ATLAS_ROWS]);
    expect(Array.from(createSplatAtlas().image.data as Uint8Array)).toEqual(Array.from(pixels().data));
  });

  it("garde un bord transparent autour de chaque case : les mipmaps n'y mélangent que du vide", () => {
    for (let row = 0; row < ATLAS_ROWS; row++) {
      for (let column = 0; column < ATLAS_COLUMNS; column++) {
        for (const pixel of opaque(column, row)) {
          const [x, y] = pixel.split(",").map(Number) as [number, number];
          expect(Math.min(x, y, CELL - 1 - x, CELL - 1 - y), `case ${column},${row}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("chaque case porte une tache, et toutes diffèrent", () => {
    const formes = [];
    for (let row = 0; row < ATLAS_ROWS; row++) {
      for (let column = 0; column < ATLAS_COLUMNS; column++) {
        const forme = opaque(column, row);
        expect(forme.length, `case ${column},${row}`).toBeGreaterThan(80);
        formes.push(forme.join(" "));
      }
    }
    expect(new Set(formes).size).toBe(ATLAS_COLUMNS * ATLAS_ROWS);
  });

  it("n'utilise que des pixels pleins ou vides : jamais de transparence partielle", () => {
    const { data } = pixels();
    for (let i = 3; i < data.length; i += 4) expect(data[i] === 0 || data[i] === 255).toBe(true);
  });
});
