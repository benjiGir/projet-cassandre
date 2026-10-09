import * as THREE from "three";
import { runGameplaySync } from "../../../app/runtime/gameRuntime";
import { RenderService } from "../../pipeline/renderService";

// see: docs/4-technique/trains-metro.md#cycle-de-vie
export async function warmTrainModel(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  models: readonly THREE.Object3D[],
  previousRoot?: THREE.Object3D,
): Promise<void> {
  const states = new Map<THREE.Object3D, boolean>();
  const batchStates = new Map<THREE.BatchedMesh, boolean>();
  for (const model of models) {
    model.visible = true;
    model.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        states.set(obj, obj.frustumCulled);
        obj.frustumCulled = false;
      }
      if (obj instanceof THREE.BatchedMesh) {
        batchStates.set(obj, obj.perObjectFrustumCulled);
        obj.perObjectFrustumCulled = false;
      }
    });
  }
  const previousTarget = renderer.getRenderTarget(),
    previousParent = previousRoot?.parent;
  const render = () => runGameplaySync(RenderService.use((rs) => rs.render(renderer, scene, camera)));
  try {
    previousRoot?.removeFromParent();
    renderer.setRenderTarget(null);
    render();
    await Promise.resolve();
    render();
  } finally {
    for (const model of models) model.visible = false;
    for (const [obj, culled] of states) obj.frustumCulled = culled;
    for (const [batch, culled] of batchStates) batch.perObjectFrustumCulled = culled;
    if (previousRoot && previousParent) previousParent.add(previousRoot);
    render();
    renderer.setRenderTarget(previousTarget);
  }
}
