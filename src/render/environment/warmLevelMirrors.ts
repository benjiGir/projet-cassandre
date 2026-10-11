import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { runGameplaySync } from "../../app/runtime/gameRuntime";
import { RenderService } from "../pipeline/renderService";

// see: docs/4-technique/chargement-de-niveau.md#miroirs
export async function warmLevelMirrors(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  root: THREE.Object3D,
): Promise<void> {
  const mirrors: Reflector[] = [];
  root.traverse((object) => {
    if (object instanceof Reflector) mirrors.push(object);
  });
  if (mirrors.length === 0) return;
  const target = renderer.getRenderTarget();
  const view = camera.clone();
  const center = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  const render = (pose: THREE.Camera) =>
    runGameplaySync(RenderService.use((service) => service.render(renderer, scene, pose)));
  try {
    root.updateWorldMatrix(true, true);
    renderer.setRenderTarget(null);
    for (const mirror of mirrors) {
      mirror.getWorldPosition(center);
      mirror.getWorldQuaternion(orientation);
      normal.set(0, 0, 1).applyQuaternion(orientation);
      view.position.copy(center).addScaledVector(normal, 3);
      view.lookAt(center);
      view.updateMatrixWorld(true);
      render(view);
      await Promise.resolve();
      render(view);
    }
  } finally {
    renderer.setRenderTarget(target);
    render(camera);
  }
}
