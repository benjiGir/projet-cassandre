import * as THREE from "three";
import { runGameplaySync } from "../../../app/runtime/gameRuntime";
import { RenderService } from "../../pipeline/renderService";

// see: docs/4-technique/trains-metro.md#cycle-de-vie
export async function warmTrainModel(renderer: THREE.WebGLRenderer, scene: THREE.Scene,
  camera: THREE.Camera, root: THREE.Object3D, model: THREE.Object3D, previousRoot?: THREE.Object3D): Promise<void> {
  const preview = model.clone(true);
  preview.visible = true;
  preview.traverse(obj => { if (obj instanceof THREE.Mesh) obj.frustumCulled = false; });
  const previousTarget = renderer.getRenderTarget(), previousParent = previousRoot?.parent;
  const render = () => runGameplaySync(RenderService.use(rs => rs.render(renderer, scene, camera)));
  try {
    previousRoot?.removeFromParent();
    root.add(preview);
    renderer.setRenderTarget(null);
    render();
    await Promise.resolve();
    render();
  } finally {
    preview.removeFromParent();
    if (previousRoot && previousParent) previousParent.add(previousRoot);
    render();
    renderer.setRenderTarget(previousTarget);
  }
}
