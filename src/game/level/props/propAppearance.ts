import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

export interface PropBreakShape {
  center: THREE.Vector3;
  halfExtents: THREE.Vector3;
  rotation: THREE.Quaternion;
  color: THREE.Color;
}

export function capturePropBreakShape(
  mesh: THREE.Mesh,
  body: RAPIER.RigidBody,
  halfExtents: THREE.Vector3,
): PropBreakShape {
  const position = body.translation(),
    rotation = body.rotation();
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const color =
    material && "color" in material && material.color instanceof THREE.Color
      ? material.color.clone()
      : new THREE.Color();
  const colors = mesh.geometry.getAttribute("color");
  if (colors) {
    let r = 0,
      g = 0,
      b = 0,
      count = 0;
    for (let i = 0; i < colors.count; i += Math.max(1, Math.floor(colors.count / 32))) {
      r += colors.getX(i);
      g += colors.getY(i);
      b += colors.getZ(i);
      count++;
    }
    if (count > 0) color.multiply(new THREE.Color(r / count, g / count, b / count));
  }
  return {
    center: new THREE.Vector3(position.x, position.y, position.z),
    halfExtents: halfExtents.clone(),
    rotation: new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
    color,
  };
}
