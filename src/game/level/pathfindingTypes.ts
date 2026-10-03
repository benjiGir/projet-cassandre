import type * as THREE from "three";
import { Schema } from "effect";
import type { Effect } from "effect";
import type { PhysicsWorld } from "../../physics/world";

// see: docs/archive/systems-pathfinding.md#limite-verticale-acceptée
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

/** Aucun chemin trouvable — soit `from`/`to` n'ont aucune cellule praticable à proximité (voir `NEAREST_CELL_SEARCH_RADIUS`), soit les deux cellules trouvées appartiennent à des composantes du graphe non connectées. */
export class PathNotFoundError extends Schema.TaggedError<PathNotFoundError>()("PathNotFoundError", {
  fromX: Schema.Number,
  fromZ: Schema.Number,
  toX: Schema.Number,
  toZ: Schema.Number,
}) {}

export interface PathfindingServiceShape {
  readonly bake: (physics: PhysicsWorld, bounds: THREE.Box3) => Effect.Effect<NavGraph>;

  readonly findPath: (
    graph: NavGraph,
    from: THREE.Vector3,
    to: THREE.Vector3,
  ) => Effect.Effect<ReadonlyArray<THREE.Vector3>, PathNotFoundError>;
}

export interface AStarMetrics {
  queries: number;
  misses: number;
  expandedNodes: number;
  lastMs: number;
  maxMs: number;
}
