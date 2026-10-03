import type * as THREE from "three";
import { Effect } from "effect";
import { PathNotFoundError, type NavGraph, type AStarMetrics } from "./pathfindingTypes";
import { DIRS, cellWorldPosition, nearestWalkableCellIndex } from "./navGraph";

// A* — tas binaire array-based, AUCUNE Map/Set, tie-break stable par index de grille croissant (déterminisme).

interface HeapNode {
  readonly index: number;
  readonly f: number;
}

class MinHeap {
  private readonly items: HeapNode[] = [];

  get size(): number {
    return this.items.length;
  }

  push(node: HeapNode): void {
    this.items.push(node);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): HeapNode | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (top === undefined) return undefined;
    if (this.items.length > 0 && last !== undefined) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  /** `f` d'abord, puis `index` croissant — JAMAIS l'ordre d'insertion. */
  private less(a: HeapNode, b: HeapNode): boolean {
    if (a.f !== b.f) return a.f < b.f;
    return a.index < b.index;
  }

  private bubbleUp(start: number): void {
    let i = start;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.less(this.items[i]!, this.items[parent]!)) {
        const tmp = this.items[i]!;
        this.items[i] = this.items[parent]!;
        this.items[parent] = tmp;
        i = parent;
      } else break;
    }
  }

  private bubbleDown(start: number): void {
    let i = start;
    const n = this.items.length;
    for (;;) {
      const left = i * 2 + 1;
      const right = i * 2 + 2;
      let smallest = i;
      if (left < n && this.less(this.items[left]!, this.items[smallest]!)) smallest = left;
      if (right < n && this.less(this.items[right]!, this.items[smallest]!)) smallest = right;
      if (smallest === i) break;
      const tmp = this.items[i]!;
      this.items[i] = this.items[smallest]!;
      this.items[smallest] = tmp;
      i = smallest;
    }
  }
}

/** Distance octile, admissible pour un coût 1/√2 par pas — cohérente avec `DIRS`. */
function heuristic(graph: NavGraph, aIdx: number, bIdx: number): number {
  const ax = aIdx % graph.cols;
  const az = Math.floor(aIdx / graph.cols);
  const bx = bIdx % graph.cols;
  const bz = Math.floor(bIdx / graph.cols);
  const dx = Math.abs(ax - bx);
  const dz = Math.abs(az - bz);
  const straight = Math.abs(dx - dz);
  const diagonal = Math.min(dx, dz);
  return (straight + diagonal * Math.SQRT2) * graph.cellSize;
}

function reconstructPath(cameFrom: Int32Array, startIdx: number, goalIdx: number): number[] {
  const path: number[] = [goalIdx];
  let current = goalIdx;
  while (current !== startIdx) {
    current = cameFrom[current]!;
    path.push(current);
  }
  path.reverse();
  return path;
}

const astarMetrics: AStarMetrics = { queries: 0, misses: 0, expandedNodes: 0, lastMs: 0, maxMs: 0 };

/** Compteurs de diagnostic uniquement ; ils n'entrent jamais dans les décisions de simulation. */
export function astarMetricsSnapshot(): Readonly<AStarMetrics> {
  return { ...astarMetrics };
}

/** A* sur `graph`. Retourne `null` si `goalIdx` n'est pas atteignable depuis `startIdx` (composantes non connectées du graphe). */
function astar(graph: NavGraph, startIdx: number, goalIdx: number): number[] | null {
  const startedAt = performance.now();
  astarMetrics.queries++;
  let expandedNodes = 0;
  const size = graph.cols * graph.rows;
  const gScore = new Float64Array(size).fill(Infinity);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const open = new MinHeap();

  gScore[startIdx] = 0;
  open.push({ index: startIdx, f: heuristic(graph, startIdx, goalIdx) });

  try {
    while (open.size > 0) {
      const current = open.pop()!;
      if (closed[current.index] === 1) continue; // entrée obsolète du tas (pas de decrease-key, voir la doc du module).
      expandedNodes++;
      if (current.index === goalIdx) return reconstructPath(cameFrom, startIdx, goalIdx);
      closed[current.index] = 1;

      const mask = graph.neighborMask[current.index]!;
      if (mask === 0) continue;

      const ix = current.index % graph.cols;
      const iz = Math.floor(current.index / graph.cols);

      for (let dirIndex = 0; dirIndex < DIRS.length; dirIndex++) {
        if ((mask & (1 << dirIndex)) === 0) continue;
        const dir = DIRS[dirIndex]!;
        const nx = ix + dir.dx;
        const nz = iz + dir.dz;
        if (nx < 0 || nx >= graph.cols || nz < 0 || nz >= graph.rows) continue;

        const nIdx = nz * graph.cols + nx;
        if (closed[nIdx] === 1) continue;

        const tentativeG = gScore[current.index]! + dir.cost * graph.cellSize;
        if (tentativeG < gScore[nIdx]!) {
          gScore[nIdx] = tentativeG;
          cameFrom[nIdx] = current.index;
          open.push({ index: nIdx, f: tentativeG + heuristic(graph, nIdx, goalIdx) });
        }
      }
    }
    astarMetrics.misses++;
    return null;
  } finally {
    const elapsed = performance.now() - startedAt;
    astarMetrics.expandedNodes += expandedNodes;
    astarMetrics.lastMs = elapsed;
    astarMetrics.maxMs = Math.max(astarMetrics.maxMs, elapsed);
  }
}

export const findPathEffect = (
  graph: NavGraph,
  from: THREE.Vector3,
  to: THREE.Vector3,
): Effect.Effect<ReadonlyArray<THREE.Vector3>, PathNotFoundError> =>
  Effect.gen(function* () {
    const startIdx = nearestWalkableCellIndex(graph, from.x, from.z);
    const goalIdx = nearestWalkableCellIndex(graph, to.x, to.z);

    if (startIdx === null || goalIdx === null) {
      return yield* new PathNotFoundError({ fromX: from.x, fromZ: from.z, toX: to.x, toZ: to.z });
    }

    if (startIdx === goalIdx) {
      return [cellWorldPosition(graph, goalIdx)];
    }

    const indices = astar(graph, startIdx, goalIdx);
    if (!indices) {
      return yield* new PathNotFoundError({ fromX: from.x, fromZ: from.z, toX: to.x, toZ: to.z });
    }

    // `indices[0]` == `startIdx` : exclu du résultat, l'appelant y est déjà (voir la doc de `findPath`).
    return indices.slice(1).map((idx) => cellWorldPosition(graph, idx));
  });
