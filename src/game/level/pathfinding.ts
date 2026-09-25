import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Context, Effect, Layer, Schema } from "effect";

import { GROUP, interactionGroups, type PhysicsWorld } from "../../physics/world";
import { RaycastService } from "../../physics/raycast";
import { suitConfig } from "../entities/suitConfig";

/**
 * `PathfindingService` (jalon M4) : premier VRAI système de pathfinding du
 * jeu, en complément des 3 rayons d'évitement local de `Suit`/`Director`
 * (`computeAvoidedDirection`). Graphe de praticabilité 2.5D, baké au
 * chargement du niveau (échantillonnage, élagage, arêtes, A* déterministe),
 * dimensionné sur le gabarit du Costard, jamais celui du Directeur, et
 * stateless comme `RaycastService`/`DeterministicRandom`.
 * see: docs/systems/pathfinding.md
 */

// Constantes de bake.

/** Pas de la grille horizontale, mètres — multiple de la grille de construction Blender (0.25 m). */
export const NAV_CELL_SIZE = 0.5;

/** Marge au-dessus/au-dessous de l'AABB fournie pour l'origine/la portée du rayon vertical descendant — purement défensif contre une géométrie exactement affleurante aux bornes de `bounds`. */
const RAY_MARGIN_UP = 2;
const RAY_MARGIN_DOWN = 2;

/**
 * `normal.y` minimale d'un hit vertical pour être compté comme un sol —
 * Alignée sur `suitConfig.maxSlopeClimbAngleDeg` du KCC : une pente que le
 * contrôleur refuserait ne doit pas devenir un sol navigable.
 */
const MIN_FLOOR_NORMAL_Y = Math.cos((suitConfig.maxSlopeClimbAngleDeg * Math.PI) / 180);

/** Marche verticale maximale du KCC ennemi. Les pentes continues sont
 * traitées à part avec l'angle de montée du même contrôleur.
 * see: docs/systems/pathfinding.md#la-marche-verticale-maximale-entre-deux-cellules-reliées-max_step_height */
const MAX_STEP_HEIGHT = suitConfig.autostepMaxHeight;

/** Décalage vertical du centre de la capsule de test d'élagage au-dessus du sol détecté — évite qu'une capsule tangente au sol touche par accident un collider adjacent qui affleure aussi au niveau du sol (ex. le pied d'un mur). */
const STAND_CLEARANCE = 0.05;

/** Rayon de recherche (en cellules) d'une cellule praticable la plus proche d'une position monde quelconque — voir `nearestWalkableCellIndex`. */
const NEAREST_CELL_SEARCH_RADIUS = 6;

/** Filtre « rayon d'ENEMY qui ne teste QUE la géométrie du niveau » —
 * DUPLIQUÉ depuis `suit.ts`/`director.ts` (aucun des deux ne l'exporte). */
const WORLD_ONLY_RAY_GROUPS = interactionGroups(GROUP.ENEMY, GROUP.WORLD);

/** Rotation identité, réutilisée pour `intersectionsWithShape` (capsule verticale, axe local Y déjà vertical — pas de rotation nécessaire, contrairement à la capsule horizontale du pied-de-biche dans `weapons.ts`). */
const IDENTITY_ROTATION: RAPIER.Rotation = { x: 0, y: 0, z: 0, w: 1 };

// Directions canoniques — ORDRE FIXE, jamais dérivé d'une itération de
// Map/Set (déterminisme). Index = bit dans `NavGraph.neighborMask`.

interface Dir {
  readonly dx: number;
  readonly dz: number;
  readonly cost: number;
}

/** 0:N 1:NE 2:E 3:SE 4:S 5:SW 6:W 7:NW — voisin opposé de l'index `d` = `(d + 4) % 8`. */
const DIRS: ReadonlyArray<Dir> = [
  { dx: 0, dz: -1, cost: 1 },
  { dx: 1, dz: -1, cost: Math.SQRT2 },
  { dx: 1, dz: 0, cost: 1 },
  { dx: 1, dz: 1, cost: Math.SQRT2 },
  { dx: 0, dz: 1, cost: 1 },
  { dx: -1, dz: 1, cost: Math.SQRT2 },
  { dx: -1, dz: 0, cost: 1 },
  { dx: -1, dz: -1, cost: Math.SQRT2 },
];

/**
 * Sous-ensemble de `DIRS` dont le voisin est TOUJOURS visité plus tard dans
 * l'itération de bake (ligne par ligne, `iz` croissant en boucle externe,
 * `ix` croissant en boucle interne) : E, SE, S, SW. Tester une arête
 * seulement depuis cet ensemble, puis appliquer le résultat aux DEUX
 * cellules (voir `bakeNavGraphEffect`), couvre chaque paire adjacente
 * exactement une fois — pas de second rayon redondant dans le sens inverse.
 */
const FORWARD_DIR_INDICES: ReadonlyArray<number> = [2, 3, 4, 5];

/**
 * Graphe de praticabilité 2.5D immuable. Tableaux typés indexés par
 * `iz * cols + ix`, délibérément PAS une `Map`/`Set` (déterminisme
 * d'itération, accès O(1), inspectable depuis `cassandre.pathfinding`).
 * see: docs/systems/pathfinding.md#limite-verticale-acceptée
 */
export interface NavGraph {
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  /** Coin MIN monde de la grille (coordonnée de la cellule (0,0)), PAS un centre. */
  readonly originX: number;
  readonly originZ: number;
  /** Hauteur de sol monde par cellule, `NaN` si non praticable. Longueur `cols * rows`, index `iz * cols + ix`. */
  readonly groundY: Float32Array;
  /** 1 si praticable, 0 sinon. Redondant avec `Number.isNaN(groundY[i])` mais explicite et lisible en debug. */
  readonly walkable: Uint8Array;
  /** Masque 8 bits par cellule (voir `DIRS`) des directions reliées à un voisin praticable et atteignable. 0 = aucun voisin (îlot isolé). */
  readonly neighborMask: Uint8Array;
}

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

/** Aucun chemin trouvable — soit `from`/`to` n'ont aucune cellule praticable à proximité (voir `NEAREST_CELL_SEARCH_RADIUS`), soit les deux cellules trouvées appartiennent à des composantes du graphe non connectées. */
export class PathNotFoundError extends Schema.TaggedError<PathNotFoundError>()("PathNotFoundError", {
  fromX: Schema.Number,
  fromZ: Schema.Number,
  toX: Schema.Number,
  toZ: Schema.Number,
}) {}

export interface PathfindingServiceShape {
  /**
   * Construit un `NavGraph` sur l'emprise `bounds`, fournie par l'APPELANT —
   * ce service ne touche jamais `THREE.Object3D`/`LevelHandle` lui-même.
   * Coût assumé au CHARGEMENT du niveau, jamais dans le pas fixe.
   *
   * Type ENTIÈREMENT RÉSOLU (`Effect<NavGraph>`, aucun `R` visible) : bien
   * que l'implémentation consulte `RaycastService` en interne, cette
   * dépendance est fournie PAR LE SERVICE LUI-MÊME (voir
   * `PathfindingService.layer`), jamais exposée à l'appelant.
   * see: docs/systems/pathfinding.md
   */
  readonly bake: (physics: PhysicsWorld, bounds: THREE.Box3) => Effect.Effect<NavGraph>;

  /**
   * A* déterministe entre `from` et `to` (positions MONDE quelconques, pas
   * nécessairement pile sur une cellule — voir `nearestWalkableCellIndex`).
   * Le premier élément du tableau retourné n'est JAMAIS la position de
   * départ elle-même (l'appelant y est déjà) : c'est le PROCHAIN waypoint,
   * jusqu'au dernier qui correspond à la cellule la plus proche de `to`.
   * PURE — aucune dépendance à `RaycastService`/`PhysicsWorld`, tout le
   * travail géométrique a déjà été fait par `bake`.
   */
  readonly findPath: (
    graph: NavGraph,
    from: THREE.Vector3,
    to: THREE.Vector3,
  ) => Effect.Effect<ReadonlyArray<THREE.Vector3>, PathNotFoundError>;
}

function cellIndex(graph: NavGraph, ix: number, iz: number): number {
  return iz * graph.cols + ix;
}

/** Position monde (X/Z de la cellule, Y = hauteur de sol bakée) d'une cellule par son index linéaire — pour le rendu debug/l'usage par `findPath`, PAS pour piloter une trajectoire Y (voir la doc de tête : le steering reste horizontal, le KCC gère le Y). */
function cellWorldPosition(graph: NavGraph, index: number, out = new THREE.Vector3()): THREE.Vector3 {
  const ix = index % graph.cols;
  const iz = Math.floor(index / graph.cols);
  return out.set(graph.originX + ix * graph.cellSize, graph.groundY[index]!, graph.originZ + iz * graph.cellSize);
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
    const mask = graph.neighborMask[i]!;
    // Popcount 8 bits — assez petit pour une boucle simple, pas besoin d'une astuce bit-à-bit.
    for (let bit = 0; bit < 8; bit++) if ((mask & (1 << bit)) !== 0) edgeCount++;
  }
  return { cellSize: graph.cellSize, cols: graph.cols, rows: graph.rows, cellCount: graph.walkable.length, walkableCount, edgeCount };
}

/** Implémentation réelle de `PathfindingServiceShape.bake`. Toutes les
 * requêtes physiques passent par `RaycastService`, jamais un accès direct à
 * `physics.world.*`. see: docs/systems/pathfinding.md#comment-le-graphe-est-construit */
const bakeNavGraphEffect = (physics: PhysicsWorld, bounds: THREE.Box3): Effect.Effect<NavGraph, never, RaycastService> =>
  Effect.gen(function* () {
    const raycast = yield* RaycastService;

    const cellSize = NAV_CELL_SIZE;
    const originX = bounds.min.x;
    const originZ = bounds.min.z;
    const cols = Math.max(1, Math.floor((bounds.max.x - originX) / cellSize) + 1);
    const rows = Math.max(1, Math.floor((bounds.max.z - originZ) / cellSize) + 1);
    const size = cols * rows;

    const groundY = new Float32Array(size).fill(Number.NaN);
    const floorNormalY = new Float32Array(size);
    const walkable = new Uint8Array(size);
    const neighborMask = new Uint8Array(size);

    const rayOriginY = bounds.max.y + RAY_MARGIN_UP;
    const rayLength = bounds.max.y - bounds.min.y + RAY_MARGIN_UP + RAY_MARGIN_DOWN;

    const { capsuleRadius, capsuleHalfHeight, eyeHeight } = suitConfig;
    const standingCapsule = new RAPIER.Capsule(capsuleHalfHeight, capsuleRadius);
    const verticalRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
    const horizontalRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    const capsuleStart: RAPIER.Vector = { x: 0, y: 0, z: 0 };
    const capsuleVelocity: RAPIER.Vector = { x: 0, y: 0, z: 0 };

    // Passe 1 : hauteur de sol + élagage, cellule par cellule.
    for (let iz = 0; iz < rows; iz++) {
      for (let ix = 0; ix < cols; ix++) {
        const idx = iz * cols + ix;
        const worldX = originX + ix * cellSize;
        const worldZ = originZ + iz * cellSize;

        verticalRay.origin.x = worldX;
        verticalRay.origin.y = rayOriginY;
        verticalRay.origin.z = worldZ;

        const hit = yield* raycast.castRayAndGetNormal(
          physics,
          verticalRay,
          rayLength,
          true,
          RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
          WORLD_ONLY_RAY_GROUPS,
        );
        if (!hit || hit.normal.y < MIN_FLOOR_NORMAL_Y) continue;

        const groundHeight = rayOriginY - hit.timeOfImpact;

        const standCenterY = groundHeight + STAND_CLEARANCE + capsuleHalfHeight + capsuleRadius;
        const overlaps = yield* raycast.intersectionsWithShape(
          physics,
          { x: worldX, y: standCenterY, z: worldZ },
          IDENTITY_ROTATION,
          standingCapsule,
          RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
          WORLD_ONLY_RAY_GROUPS,
          hit.collider,
        );
        if (overlaps.length > 0) continue; // pas assez de dégagement vertical pour se tenir debout ici.

        groundY[idx] = groundHeight;
        floorNormalY[idx] = hit.normal.y;
        walkable[idx] = 1;
      }
    }

    // Passe 2 : arêtes, une seule fois par paire (voir FORWARD_DIR_INDICES).
    for (let iz = 0; iz < rows; iz++) {
      for (let ix = 0; ix < cols; ix++) {
        const idx = iz * cols + ix;
        if (walkable[idx] !== 1) continue;

        for (const dirIndex of FORWARD_DIR_INDICES) {
          const dir = DIRS[dirIndex]!;
          const nx = ix + dir.dx;
          const nz = iz + dir.dz;
          if (nx < 0 || nx >= cols || nz < 0 || nz >= rows) continue;

          const nIdx = nz * cols + nx;
          if (walkable[nIdx] !== 1) continue;

          const heightDiff = Math.abs(groundY[nIdx]! - groundY[idx]!);
          const horizontalDistance = cellSize * Math.hypot(dir.dx, dir.dz);
          const touchesRamp = floorNormalY[idx]! < 0.999 || floorNormalY[nIdx]! < 0.999;
          const rampRise = Math.tan((suitConfig.maxSlopeClimbAngleDeg * Math.PI) / 180) * horizontalDistance;
          if (heightDiff > (touchesRamp ? rampRise + STAND_CLEARANCE : MAX_STEP_HEIGHT)) continue;

          const fromX = originX + ix * cellSize;
          const fromZ = originZ + iz * cellSize;
          const toX = originX + nx * cellSize;
          const toZ = originZ + nz * cellSize;
          const rayY = (groundY[idx]! + groundY[nIdx]!) / 2 + eyeHeight;

          const dxw = toX - fromX;
          const dzw = toZ - fromZ;
          const dist = Math.hypot(dxw, dzw);

          horizontalRay.origin.x = fromX;
          horizontalRay.origin.y = rayY;
          horizontalRay.origin.z = fromZ;
          horizontalRay.dir.x = dxw / dist;
          horizontalRay.dir.y = 0;
          horizontalRay.dir.z = dzw / dist;

          const wallHit = yield* raycast.castRay(
            physics,
            horizontalRay,
            Math.max(0, dist - 0.05),
            true,
            RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
            WORLD_ONLY_RAY_GROUPS,
          );
          if (wallHit) continue; // mur entre les deux cellules.

          // Sur sol plat, un rayon d'œil ne suffit pas pour un obstacle bas
          // ou un plafond : balayer la capsule réelle. Sur une pente, un
          // balayage horizontal produit un faux contact avec le sol montant ;
          // la pente est validée par sa normale et son dénivelé ci-dessus.
          if (!touchesRamp) {
            capsuleStart.x = fromX;
            capsuleStart.y = Math.max(groundY[idx]!, groundY[nIdx]!) +
              STAND_CLEARANCE + capsuleHalfHeight + capsuleRadius;
            capsuleStart.z = fromZ;
            capsuleVelocity.x = dxw;
            capsuleVelocity.y = 0;
            capsuleVelocity.z = dzw;
            const blocked = yield* raycast.castShape(
              physics, capsuleStart, IDENTITY_ROTATION, capsuleVelocity,
              standingCapsule, 0, 1, false,
              RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, WORLD_ONLY_RAY_GROUPS,
            );
            if (blocked) continue;
          }

          neighborMask[idx] |= 1 << dirIndex;
          neighborMask[nIdx] |= 1 << ((dirIndex + 4) % 8);
        }
      }
    }

    // Une diagonale ne coupe pas l'angle de deux obstacles : les deux chemins
    // orthogonaux qui la bordent doivent être physiquement ouverts.
    for (let iz = 0; iz < rows; iz++) {
      for (let ix = 0; ix < cols; ix++) {
        const idx = iz * cols + ix;
        for (const dirIndex of [3, 5]) {
          if ((neighborMask[idx]! & (1 << dirIndex)) === 0) continue;
          const dir = DIRS[dirIndex]!;
          const nIdx = (iz + dir.dz) * cols + ix + dir.dx;
          const horizontal = dir.dx > 0 ? 2 : 6;
          const vertical = dir.dz > 0 ? 4 : 0;
          const oppositeHorizontal = (horizontal + 4) % 8;
          const oppositeVertical = (vertical + 4) % 8;
          if ((neighborMask[idx]! & (1 << horizontal)) !== 0 &&
              (neighborMask[idx]! & (1 << vertical)) !== 0 &&
              (neighborMask[nIdx]! & (1 << oppositeHorizontal)) !== 0 &&
              (neighborMask[nIdx]! & (1 << oppositeVertical)) !== 0) continue;
          neighborMask[idx] &= ~(1 << dirIndex);
          neighborMask[nIdx] &= ~(1 << ((dirIndex + 4) % 8));
        }
      }
    }

    return { cellSize, cols, rows, originX, originZ, groundY, walkable, neighborMask };
  });

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

export interface AStarMetrics {
  queries: number;
  misses: number;
  expandedNodes: number;
  lastMs: number;
  maxMs: number;
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

/**
 * Cellule praticable la plus proche d'une position monde (X/Z) quelconque —
 * `from`/`to` de `findPath` ne tombent presque jamais pile sur un nœud de
 * grille. Essaie d'abord la cellule exacte, puis élargit en anneaux carrés
 * jusqu'à `NEAREST_CELL_SEARCH_RADIUS`. Tie-break déterministe par distance
 * puis par index de grille croissant — jamais par ordre de balayage
 * incidentel de la boucle.
 */
function nearestWalkableCellIndex(graph: NavGraph, x: number, z: number): number | null {
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

const findPathEffect = (
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

export class PathfindingService extends Context.Service<PathfindingService, PathfindingServiceShape>()(
  "cassandre/game/level/PathfindingService",
) {
  static readonly layer = Layer.succeed(
    PathfindingService,
    PathfindingService.of({
      // RaycastService.layer fourni ICI, à l'implémentation — voir la doc de `bake` ci-dessus.
      bake: (physics, bounds) => bakeNavGraphEffect(physics, bounds).pipe(Effect.provide(RaycastService.layer)),
      findPath: findPathEffect,
    }),
  );

  /**
   * Layer de test scriptée — par défaut, `bake` renvoie `EMPTY_NAV_GRAPH`
   * (aucune cellule) et `findPath` échoue systématiquement avec
   * `PathNotFoundError`, sans jamais toucher Rapier. Même précédent que
   * `RaycastService.test` (M3) : passer un override par méthode pour
   * scripter un résultat précis.
   */
  static readonly test = (overrides: Partial<PathfindingServiceShape> = {}) =>
    Layer.succeed(
      PathfindingService,
      PathfindingService.of({
        bake: () => Effect.succeed(EMPTY_NAV_GRAPH),
        findPath: (_graph, from, to) =>
          Effect.fail(new PathNotFoundError({ fromX: from.x, fromZ: from.z, toX: to.x, toZ: to.z })),
        ...overrides,
      }),
    );
}
