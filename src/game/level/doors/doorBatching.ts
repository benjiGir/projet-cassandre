import * as THREE from "three";
import type { LevelResources } from "../loading/levelResources";
import type { DoorInfo } from "./doorTypes";
import { attributeKey, materialKey } from "../loading/mergeStaticDecor";

export function batchDoorMeshes(root: THREE.Object3D, doors: readonly DoorInfo[], resources?: LevelResources): number {
  const groups = new Map<string, DoorInfo[]>();
  let seuls = 0;
  for (const door of doors) {
    const mesh = door.object as THREE.Mesh;
    // Le mesh reste parent de ses pièces mobiles (panneaux vitrés, par
    // exemple). Le BatchedMesh ne contient que la géométrie du vantail et
    // masquerait ces enfants : on garde alors cet ensemble animé en un lot.
    if (mesh.children.length > 0) {
      seuls++;
      continue;
    }
    if (!mesh.isMesh || Array.isArray(mesh.material) || !(mesh.material instanceof THREE.MeshLambertMaterial)) {
      seuls++;
      continue;
    }
    const key = `${materialKey(mesh.material)}#${attributeKey(mesh.geometry)}`;
    const list = groups.get(key);
    if (list) list.push(door);
    else groups.set(key, [door]);
  }

  let lots = 0;
  for (const group of groups.values()) {
    if (group.length < 2) {
      seuls += group.length;
      continue;
    }
    const meshes = group.map((door) => door.object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>);
    const vertices = meshes.reduce((n, m) => n + m.geometry.getAttribute("position").count, 0);
    const indices = meshes.reduce((n, m) => n + (m.geometry.index?.count ?? 0), 0);
    const batch = new THREE.BatchedMesh(meshes.length, vertices, indices, meshes[0].material);
    resources?.batch(batch);
    batch.name = `lot_vantaux_${lots}`;
    group.forEach((door, i) => {
      const mesh = meshes[i];
      const instanceId = batch.addInstance(batch.addGeometry(mesh.geometry));
      mesh.updateMatrix();
      batch.setMatrixAt(instanceId, mesh.matrix);
      mesh.visible = false;
      door.batchSlot = { batch, instanceId };
    });
    root.add(batch);
    lots++;
  }
  return lots + seuls;
}
