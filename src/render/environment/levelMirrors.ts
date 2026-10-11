import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import type { LevelResources } from "../../game/level/loading/levelResources";
import { revealReflectionActors } from "./reflectionActors";

const mirrorsByLevel = new WeakMap<LevelResources, Set<Reflector>>();

export function attachLevelMirror(mesh: THREE.Mesh, resources: LevelResources): boolean {
  if (mesh.userData.miroir !== true) return false;
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  const normals = mesh.geometry.getAttribute("normal");
  if (!box || !normals) return false;
  const size = box.getSize(new THREE.Vector3());
  const normal = new THREE.Vector3().fromBufferAttribute(normals, 0).normalize();
  const height = Math.abs(normal.z) > 0.5 ? size.y : size.z;
  const mirror = new Reflector(resources.geometry(new THREE.PlaneGeometry(size.x, height)), {
    color: 0xbac7c7,
    textureWidth: 640,
    textureHeight: 360,
    multisample: 0,
    clipBias: 0.003,
  });
  mirror.position.copy(box.getCenter(new THREE.Vector3()));
  mirror.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  mirror.name = `${mesh.name}_reflet`;
  const texture = mirror.getRenderTarget().texture;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  const peers = mirrorsByLevel.get(resources) ?? new Set<Reflector>();
  mirrorsByLevel.set(resources, peers);
  peers.add(mirror);
  const drawReflection = mirror.onBeforeRender;
  mirror.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
    if (renderer.getRenderTarget() === mirror.getRenderTarget()) return;
    const visibility = [...peers].map((peer) => [peer, peer.visible] as const);
    const cameraVisibility = camera.children.map((child) => [child, child.visible] as const);
    for (const [peer] of visibility) peer.visible = false;
    for (const [child] of cameraVisibility) child.visible = false;
    const hideActors = revealReflectionActors(scene);
    try {
      drawReflection.call(mirror, renderer, scene, camera, geometry, material, group);
    } finally {
      hideActors();
      for (const [peer, visible] of visibility) peer.visible = visible;
      for (const [child, visible] of cameraVisibility) child.visible = visible;
    }
  };
  mesh.material = resources.material(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  mesh.add(mirror);
  resources.onCleanup(() => {
    peers.delete(mirror);
    mirror.dispose();
  });
  return true;
}
