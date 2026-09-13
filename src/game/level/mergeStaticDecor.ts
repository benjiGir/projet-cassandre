import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// see: docs/pipeline/niveau-blender.md#fusion-du-décor-statique

/**
 * Côté d'une cellule de regroupement, mètres.
 *
 * Un lot fusionné est dessiné dès qu'une seule de ses parties entre dans le
 * champ. Regrouper le décor du niveau ENTIER par matériau (ce que faisait
 * l'ADR 0023) donne donc des lots que le tri d'écart n'élimine jamais : le
 * niveau est dessiné en entier à chaque image, dos compris. Découper d'abord
 * en cellules rend le tri d'écart à nouveau capable d'écarter ce qui n'est pas
 * vu, au prix d'un lot de plus par cellule occupée et par matériau.
 *
 * 48 m est l'ordre de grandeur d'une pièce du niveau v2 (de 12 × 48 m pour
 * l'allée centrale à 48 × 36 m pour le parking) : c'est la « fusion par
 * espace » de l'ADR 0026, obtenue sans demander au niveau de déclarer ses
 * espaces — donc valable aussi pour les niveaux déjà exportés.
 *
 * La valeur est le COUDE d'une courbe mesurée, pas un choix d'ordre de
 * grandeur — et **ce coude s'est déplacé quand l'habillage est arrivé**. Sur le
 * blockout gris, 32 m gagnait encore ; sur le niveau habillé, où chaque cellule
 * porte bien plus de matériaux distincts, 32 m coûte 163 lots de dessin au pire
 * point de vue contre 122 à 48 m, pour seulement 3,7 % de triangles en moins.
 * Au-delà (64 m), les lots ne baissent plus et les triangles remontent. Le
 * budget sous tension est celui des LOTS, pas celui des triangles : chiffres et
 * méthode dans
 * [Ce que coûte une image](../../../docs/systems/cout-de-rendu.md#découpe-du-décor-en-cellules).
 * see: docs/decisions/0026-visibilite-par-espace-et-pool-de-lampes.md
 */
export const DECOR_CELL_SIZE = 48;

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

const centerScratch = new THREE.Vector3();

/**
 * Cellule d'un mesh : celle de son CENTRE en monde, pas de son origine — un sol
 * de 42 × 36 m dont l'origine est dans un coin appartient à la cellule qu'il
 * couvre vraiment. Un objet plus grand qu'une cellule tombe donc entier dans
 * une seule ; c'est voulu, les grandes pièces sont peu nombreuses et les
 * découper coûterait plus cher que ça ne rapporte.
 */
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

/**
 * Fusionne les meshes de décor statiques qui partagent un même matériau ET une
 * même cellule de `DECOR_CELL_SIZE` mètres en un seul mesh par groupe, rattaché
 * à `root`. Chaque géométrie garde ses propres sommets, donc ses vertex colors
 * bakées. `root.matrixWorld` et ceux des candidats doivent être à jour.
 */
export function mergeStaticDecor(root: THREE.Object3D, candidates: readonly THREE.Mesh[]): DecorMergeResult {
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
