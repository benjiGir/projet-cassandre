import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// see: docs/pipeline/niveau-blender.md#fusion-du-décor-statique

export interface DecorMergeResult {
  /** Meshes de décor retirés de la scène parce qu'absorbés dans un lot fusionné. */
  readonly mergedMeshCount: number;
  /** Lots fusionnés ajoutés sous `root`. */
  readonly batchCount: number;
}

// `toLambert` crée un matériau par mesh : deux meshes à la même texture ont deux instances
// distinctes, d'où une clé par contenu plutôt que par identité.
function materialKey(mat: THREE.MeshLambertMaterial): string {
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
function attributeKey(geometry: THREE.BufferGeometry): string {
  const names = Object.keys(geometry.attributes).sort();
  return `${geometry.index ? "i" : "n"}:${names.map((n) => `${n}${geometry.attributes[n]!.itemSize}`).join(",")}`;
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

/**
 * Fusionne les meshes de décor statiques qui partagent un même matériau en un seul mesh par groupe,
 * rattaché à `root`. Chaque géométrie garde ses propres sommets, donc ses vertex colors bakées.
 * `root.matrixWorld` et ceux des candidats doivent être à jour.
 */
export function mergeStaticDecor(root: THREE.Object3D, candidates: readonly THREE.Mesh[]): DecorMergeResult {
  const groups = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>[]>();
  for (const mesh of candidates) {
    if (!isMergeable(mesh)) continue;
    const key = `${materialKey(mesh.material)}#${attributeKey(mesh.geometry)}`;
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
      return mesh.geometry.clone().applyMatrix4(toRootSpace);
    });
    const merged = mergeGeometries(geometries, false);
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
