import * as THREE from "three";
import type { NavGraph } from "./pathfindingTypes";

// see: docs/4-technique/pathfinding.md

// Constantes de bake.

/** Pas de la grille horizontale, mètres — multiple de la grille de construction Blender (0.25 m). */
export const NAV_CELL_SIZE = 0.5;

/** Rayon de recherche (en cellules) d'une cellule praticable la plus proche d'une position monde quelconque — voir `nearestWalkableCellIndex`. */
const NEAREST_CELL_SEARCH_RADIUS = 6;

// Directions canoniques — ORDRE FIXE, jamais dérivé d'une itération de
// Map/Set (déterminisme). Index = bit dans `NavGraph.neighborMask`.

interface Dir {
  readonly dx: number;
  readonly dz: number;
  readonly cost: number;
}

/** 0:N 1:NE 2:E 3:SE 4:S 5:SW 6:W 7:NW — voisin opposé de l'index `d` = `(d + 4) % 8`. */
export const DIRS: ReadonlyArray<Dir> = [
  { dx: 0, dz: -1, cost: 1 },
  { dx: 1, dz: -1, cost: Math.SQRT2 },
  { dx: 1, dz: 0, cost: 1 },
  { dx: 1, dz: 1, cost: Math.SQRT2 },
  { dx: 0, dz: 1, cost: 1 },
  { dx: -1, dz: 1, cost: Math.SQRT2 },
  { dx: -1, dz: 0, cost: 1 },
  { dx: -1, dz: -1, cost: Math.SQRT2 },
];

export const FORWARD_DIR_INDICES: ReadonlyArray<number> = [2, 3, 4, 5];

/** Graphe vide (0 cellule) — utilisé comme repli par `PathfindingService.test()` et pour tout appelant qui n'a pas encore baké de niveau. */
export const EMPTY_NAV_GRAPH: NavGraph = {
  cellSize: NAV_CELL_SIZE,
  cols: 0,
  rows: 0,
  originX: 0,
  originZ: 0,
  groundY: new Float32Array(0),
  walkable: new Uint8Array(0),
  neighborMask: new Uint8Array(0),
};

export function cellIndex(graph: NavGraph, ix: number, iz: number): number {
  return iz * graph.cols + ix;
}

/** Position monde (X/Z de la cellule, Y = hauteur de sol bakée) d'une cellule par son index linéaire — pour le rendu debug/l'usage par `findPath`, PAS pour piloter une trajectoire Y (voir la doc de tête : le steering reste horizontal, le KCC gère le Y). */
export function cellWorldPosition(graph: NavGraph, index: number, out = new THREE.Vector3()): THREE.Vector3 {
  const ix = index % graph.cols;
  const iz = Math.floor(index / graph.cols);
  return out.set(graph.originX + ix * graph.cellSize, graph.groundY[index], graph.originZ + iz * graph.cellSize);
}

/** Lecture debug directe d'une cellule par ses coordonnées de grille — exportée pour `cassandre.pathfinding`/les tests, voir `navGraphStats` pour un résumé agrégé. */
export function isCellWalkable(graph: NavGraph, ix: number, iz: number): boolean {
  if (ix < 0 || ix >= graph.cols || iz < 0 || iz >= graph.rows) return false;
  return graph.walkable[cellIndex(graph, ix, iz)] === 1;
}

/** Résumé agrégé d'un `NavGraph`, pour `cassandre.pathfinding.stats()`/les tests — évite de forcer un consommateur externe à itérer les tableaux typés bruts. */
export function navGraphStats(graph: NavGraph): {
  cellSize: number;
  cols: number;
  rows: number;
  cellCount: number;
  walkableCount: number;
  edgeCount: number;
} {
  let walkableCount = 0;
  let edgeCount = 0;
  for (let i = 0; i < graph.walkable.length; i++) {
    if (graph.walkable[i] === 1) walkableCount++;
    const mask = graph.neighborMask[i];
    // Popcount 8 bits — assez petit pour une boucle simple, pas besoin d'une astuce bit-à-bit.
    for (let bit = 0; bit < 8; bit++) if ((mask & (1 << bit)) !== 0) edgeCount++;
  }
  return {
    cellSize: graph.cellSize,
    cols: graph.cols,
    rows: graph.rows,
    cellCount: graph.walkable.length,
    walkableCount,
    edgeCount,
  };
}

export function nearestWalkableCellIndex(graph: NavGraph, x: number, z: number): number | null {
  if (graph.cols === 0 || graph.rows === 0) return null;

  const cx = Math.round((x - graph.originX) / graph.cellSize);
  const cz = Math.round((z - graph.originZ) / graph.cellSize);

  if (cx >= 0 && cx < graph.cols && cz >= 0 && cz < graph.rows) {
    const idx = cellIndex(graph, cx, cz);
    if (graph.walkable[idx] === 1) return idx;
  }

  for (let radius = 1; radius <= NEAREST_CELL_SEARCH_RADIUS; radius++) {
    let bestIdx: number | null = null;
    let bestDistSq = Infinity;

    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue; // seul l'anneau EXTÉRIEUR de ce rayon, l'intérieur a déjà été couvert.
        const gx = cx + dx;
        const gz = cz + dz;
        if (gx < 0 || gx >= graph.cols || gz < 0 || gz >= graph.rows) continue;

        const idx = cellIndex(graph, gx, gz);
        if (graph.walkable[idx] !== 1) continue;

        const wx = graph.originX + gx * graph.cellSize;
        const wz = graph.originZ + gz * graph.cellSize;
        const distSq = (wx - x) ** 2 + (wz - z) ** 2;

        if (distSq < bestDistSq || (distSq === bestDistSq && (bestIdx === null || idx < bestIdx))) {
          bestDistSq = distSq;
          bestIdx = idx;
        }
      }
    }

    if (bestIdx !== null) return bestIdx;
  }

  return null;
}
