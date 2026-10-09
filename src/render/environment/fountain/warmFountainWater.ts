import type * as THREE from "three";
import { Mesh } from "three";
import { runGameplaySync } from "../../../app/runtime/gameRuntime";
import { RenderService } from "../../pipeline/renderService";
import type { FountainWater } from "./fountainWater";

export function suspendPreviousFountainWater(root?: THREE.Object3D): () => void {
  const fountain = root?.getObjectByName("fx_fontaine_eau");
  if (!fountain) return () => {};
  const visible = fountain.visible;
  fountain.visible = false;
  for (const mesh of fountain.children) {
    if (!(mesh instanceof Mesh) || mesh.name === "fx_fontaine_buse") continue;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
  }
  return () => {
    fountain.visible = visible;
  };
}

export async function warmFountainWater(
  fountain: FountainWater,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  previousRoot?: THREE.Object3D,
): Promise<void> {
  const target = renderer.getRenderTarget();
  const parent = previousRoot?.parent;
  const poses = fountain.group.children.map((mesh) => ({ mesh, culled: mesh.frustumCulled }));
  try {
    previousRoot?.removeFromParent();
    for (const { mesh } of poses) mesh.frustumCulled = false;
    renderer.setRenderTarget(null);
    runGameplaySync(RenderService.use((rs) => rs.render(renderer, scene, camera)));
    await Promise.resolve();
    runGameplaySync(RenderService.use((rs) => rs.render(renderer, scene, camera)));
  } finally {
    for (const { mesh, culled } of poses) mesh.frustumCulled = culled;
    if (previousRoot && parent) parent.add(previousRoot);
    renderer.setRenderTarget(target);
  }
}
