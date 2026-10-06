import type { Mesh } from "three";

const VIEWMODEL_DEPTH_RANGE = 0.05;

export function drawOverWorld<T extends Mesh>(mesh: T): T {
  mesh.onBeforeRender = (renderer) => renderer.getContext().depthRange(0, VIEWMODEL_DEPTH_RANGE);
  mesh.onAfterRender = (renderer) => renderer.getContext().depthRange(0, 1);
  return mesh;
}
