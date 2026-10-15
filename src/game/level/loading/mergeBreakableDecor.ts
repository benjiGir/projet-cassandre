import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { LevelResources } from "./levelResources";

// see: docs/6-reference/notes-code-gameplay-niveau.md#objets-cassables-et-interactions

type BreakableMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;

/** Sommets d'un objet cassable : sa plage dans le lot fusionné, ou toute sa propre géométrie s'il est resté seul. */
export interface BreakableRange<C> {
  readonly candidate: C;
  readonly batchGeometry: THREE.BufferGeometry;
  readonly vertexStart: number;
  readonly vertexCount: number;
}

export interface BreakableMergeResult<C> {
  /** Une plage par candidat. */
  readonly ranges: BreakableRange<C>[];
  /** Meshes rendus après fusion : les lots, et les candidats restés seuls. */
  readonly rendered: BreakableMesh[];
  /** Lots ajoutés sous `root` : un par matériau partagé par deux candidats ou plus. */
  readonly batchCount: number;
}

function materialKey(mat: THREE.MeshLambertMaterial): string {
  return [mat.map?.uuid ?? "-", mat.color.getHexString(), mat.transparent, mat.opacity, mat.alphaTest].join("|");
}

/** Centre d'une plage de sommets `[start, start+count)` d'un attribut position — espace de l'attribut lui-même, quel qu'il soit. */
export function rangeCenter(position: THREE.BufferAttribute, start: number, count: number): THREE.Vector3 {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = start; i < start + count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (x < min.x) min.x = x;
    if (y < min.y) min.y = y;
    if (z < min.z) min.z = z;
    if (x > max.x) max.x = x;
    if (y > max.y) max.y = y;
    if (z > max.z) max.z = z;
  }
  return min.add(max).multiplyScalar(0.5);
}

/** Un candidat non fusionné devient sa propre plage : toute sa géométrie, espace inchangé. */
function passthrough<C extends { readonly mesh: BreakableMesh }>(candidate: C): BreakableRange<C> {
  const { geometry } = candidate.mesh;
  return { candidate, batchGeometry: geometry, vertexStart: 0, vertexCount: geometry.getAttribute("position").count };
}

/**
 * Fusionne par matériau des objets cassables : un lot de dessin par matériau,
 * où chaque objet garde une plage de sommets qu'on peut modifier seule à la
 * casse. `keepSeparate` laisse un candidat hors de tout lot.
 */
export function mergeBreakableDecor<C extends { readonly mesh: BreakableMesh }>(
  root: THREE.Object3D,
  candidates: readonly C[],
  batchPrefix: string,
  resources?: LevelResources,
  keepSeparate: (candidate: C) => boolean = () => false,
): BreakableMergeResult<C> {
  const ranges: BreakableRange<C>[] = [];
  const rendered: BreakableMesh[] = [];
  const keep = (candidate: C): void => {
    ranges.push(passthrough(candidate));
    rendered.push(candidate.mesh);
  };

  const groups = new Map<string, C[]>();
  for (const candidate of candidates) {
    if (keepSeparate(candidate)) {
      keep(candidate);
      continue;
    }
    const key = materialKey(candidate.mesh.material);
    const list = groups.get(key);
    if (list) list.push(candidate);
    else groups.set(key, [candidate]);
  }

  const rootInverse = root.matrixWorld.clone().invert();
  const toRootSpace = new THREE.Matrix4();
  let batchCount = 0;

  for (const group of groups.values()) {
    if (group.length < 2) {
      keep(group[0]);
      continue;
    }

    const geometries = group.map((candidate) => {
      toRootSpace.multiplyMatrices(rootInverse, candidate.mesh.matrixWorld);
      const geometry = candidate.mesh.geometry.clone();
      resources?.geometry(geometry);
      return geometry.applyMatrix4(toRootSpace);
    });
    const merged = mergeGeometries(geometries, false);
    if (!merged) {
      // Repli défensif (attributs incompatibles, ne devrait jamais arriver
      // pour des meshes à un seul matériau) : chaque objet garde sa PROPRE
      // géométrie plutôt que de disparaître du niveau.
      for (const g of geometries) g.dispose();
      for (const candidate of group) keep(candidate);
      continue;
    }
    resources?.geometry(merged);

    const batch = new THREE.Mesh(merged, group[0].mesh.material);
    batch.name = `${batchPrefix}_${batchCount}`;
    root.add(batch);
    batch.updateMatrixWorld(true);
    batchCount++;
    rendered.push(batch);

    let cursor = 0;
    for (let i = 0; i < group.length; i++) {
      const vertexCount = geometries[i].getAttribute("position").count;
      ranges.push({ candidate: group[i], batchGeometry: merged, vertexStart: cursor, vertexCount });
      cursor += vertexCount;
    }

    for (const g of geometries) g.dispose();
    for (const candidate of group) {
      candidate.mesh.removeFromParent();
      candidate.mesh.geometry.dispose();
      if (candidate.mesh.material !== batch.material) candidate.mesh.material.dispose();
    }
  }

  return { ranges, rendered, batchCount };
}
