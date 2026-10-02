import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { LevelResources } from "./levelResources";

// see: docs/archive/pipeline-niveau-blender.md#fusion-du-décor-statique

// see: docs/decisions/0026-visibilite-par-espace-et-pool-de-lampes.md
export const DECOR_CELL_SIZE = 48;

export interface DecorMergeResult {
  /** Meshes de décor retirés de la scène parce qu'absorbés dans un lot fusionné. */
  readonly mergedMeshCount: number;
  /** Lots fusionnés ajoutés sous `root`. */
  readonly batchCount: number;
}

// `toLambert` crée un matériau par mesh : deux meshes à la même texture ont deux instances
// distinctes, d'où une clé par contenu plutôt que par identité.
export function materialKey(mat: THREE.MeshLambertMaterial): string {
  return [
    mat.map?.uuid ?? "-",
    mat.color.getHexString(),
    mat.emissive.getHexString(),
    mat.emissiveIntensity,
    mat.vertexColors,
    mat.side,
    mat.transparent,
    mat.opacity,
    mat.alphaTest,
  ].join("|");
}

// `mergeGeometries` refuse de mélanger géométries indexées et non indexées, ou des jeux d'attributs différents.
export function attributeKey(geometry: THREE.BufferGeometry): string {
  const names = Object.keys(geometry.attributes).sort();
  return `${geometry.index ? "i" : "n"}:${names.map((n) => `${n}${geometry.attributes[n]!.itemSize}`).join(",")}`;
}

const centerScratch = new THREE.Vector3();

// see: docs/6-reference/notes-code-gameplay-niveau.md#fusion-et-poses
function cellKey(mesh: THREE.Mesh): string {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  if (!box) return "0/0/0";
  box.getCenter(centerScratch).applyMatrix4(mesh.matrixWorld);
  const q = (v: number): number => Math.floor(v / DECOR_CELL_SIZE);
  return `${q(centerScratch.x)}/${q(centerScratch.y)}/${q(centerScratch.z)}`;
}

function isMergeable(mesh: THREE.Mesh): mesh is THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial> {
  return (
    mesh.visible &&
    mesh.children.length === 0 &&
    !(mesh instanceof THREE.SkinnedMesh) &&
    !(mesh instanceof THREE.InstancedMesh) &&
    !Array.isArray(mesh.material) &&
    mesh.material instanceof THREE.MeshLambertMaterial &&
    Object.keys(mesh.geometry.morphAttributes).length === 0 &&
    // Échelle négative : la transformation inverse l'ordre des sommets et les faces fusionnées
    // seraient éliminées par le back-face culling.
    mesh.matrixWorld.determinant() > 0
  );
}

export function mergeStaticDecor(root: THREE.Object3D, candidates: readonly THREE.Mesh[], resources?: LevelResources): DecorMergeResult {
  const groups = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>[]>();
  for (const mesh of candidates) {
    if (!isMergeable(mesh)) continue;
    const key = `${materialKey(mesh.material)}#${attributeKey(mesh.geometry)}#${cellKey(mesh)}`;
    const group = groups.get(key);
    if (group) group.push(mesh);
    else groups.set(key, [mesh]);
  }

  const rootInverse = root.matrixWorld.clone().invert();
  const toRootSpace = new THREE.Matrix4();
  let mergedMeshCount = 0;
  let batches = 0;

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const geometries = group.map((mesh) => {
      toRootSpace.multiplyMatrices(rootInverse, mesh.matrixWorld);
      const geometry = mesh.geometry.clone();
      resources?.geometry(geometry);
      return geometry.applyMatrix4(toRootSpace);
    });
    const merged = mergeGeometries(geometries, false);
    if (merged) resources?.geometry(merged);
    for (const g of geometries) g.dispose();
    if (!merged) continue;

    const batch = new THREE.Mesh(merged, group[0]!.material);
    batch.name = `decor_fusion_${batches}`;
    root.add(batch);
    batch.updateMatrixWorld(true);
    batches++;

    for (const mesh of group) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      // La texture est partagée avec le lot : on libère le matériau dupliqué, jamais sa `map`.
      if (mesh.material !== batch.material) mesh.material.dispose();
    }
    mergedMeshCount += group.length;
  }

  return { mergedMeshCount, batchCount: batches };
}
