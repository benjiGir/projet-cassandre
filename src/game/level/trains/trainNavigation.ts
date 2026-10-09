import * as THREE from "three";
import { DIRS } from "../navigation/navGraph";
import type { NavGraph } from "../navigation/pathfindingTypes";
import type { TrainBox } from "./trainLevelData";

// see: docs/4-technique/trains-metro.md#navigation
export function excludeTrainRails(graph: NavGraph, zones: readonly TrainBox[], crossings: readonly TrainBox[]): void {
  const point = new THREE.Vector3();
  for (let index = 0; index < graph.walkable.length; index++) {
    if (!graph.walkable[index]) continue;
    point.set(
      graph.originX + (index % graph.cols) * graph.cellSize,
      graph.groundY[index],
      graph.originZ + Math.floor(index / graph.cols) * graph.cellSize,
    );
    if (
      zones.some(
        (zone) =>
          zone.box.containsPoint(point) &&
          !crossings.some((crossing) => crossing.lane === zone.lane && crossing.box.containsPoint(point)),
      )
    ) {
      graph.walkable[index] = 0;
      graph.neighborMask[index] = 0;
    }
  }
  for (let index = 0; index < graph.walkable.length; index++) {
    if (!graph.walkable[index]) continue;
    const x = index % graph.cols,
      z = Math.floor(index / graph.cols);
    for (let direction = 0; direction < DIRS.length; direction++) {
      const { dx, dz } = DIRS[direction];
      const nx = x + dx,
        nz = z + dz;
      if (
        nx < 0 ||
        nx >= graph.cols ||
        nz < 0 ||
        nz >= graph.rows ||
        !graph.walkable[nz * graph.cols + nx] ||
        (dx !== 0 && dz !== 0 && (!graph.walkable[z * graph.cols + nx] || !graph.walkable[nz * graph.cols + x]))
      )
        graph.neighborMask[index] &= ~(1 << direction);
    }
  }
}
