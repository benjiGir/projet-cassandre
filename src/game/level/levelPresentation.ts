import * as THREE from "three";
import type { LevelResources } from "./levelResources";
import { configureRetroTexture } from "../../render/renderer";
import { cleanExtras } from "./levelExtras";

// Conversion des matériaux glTF vers le rendu rétro.
// see: docs/6-reference/notes-code-gameplay-niveau.md#chargement-et-ressources

function toLambert(mat: THREE.Material, hasVertexColors: boolean, resources: LevelResources): THREE.MeshLambertMaterial {
  const src = mat as THREE.MeshStandardMaterial;
  const lambert = resources.material(new THREE.MeshLambertMaterial({
    color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
    map: src.map ?? null,
    transparent: src.transparent,
    opacity: src.opacity,
    side: src.side,
    alphaTest: src.alphaTest,
    vertexColors: hasVertexColors,
    // Le décor Lambert ignore les cartes PBR ; les effets TSL sont posés ensuite.
  }));
  lambert.name = mat.name;
  if (lambert.map) {
    // Invariant #4 : `NearestFilter` à l'AGRANDISSEMENT, toujours — c'est lui
    // qui fait le gros pixel franc. La réduction (les surfaces vues de loin)
    // suit le mode courant : voir `configureRetroTexture` et l'ADR 0027.
    configureRetroTexture(lambert.map);
  }
  return lambert;
}

export function convertToLambert(mesh: THREE.Mesh, resources: LevelResources): void {
  const hasVertexColors = mesh.geometry.hasAttribute("color");
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((mat) => toLambert(mat, hasVertexColors, resources));
  } else {
    mesh.material = toLambert(mesh.material, hasVertexColors, resources);
  }
}

// see: docs/archive/systems-rendu.md#éclairage-hybride-lampes-temps-réel-ombre-cuite
export function buildLevelLight(obj: THREE.Object3D, name: string): THREE.PointLight {
  const extras = cleanExtras(obj);
  const read = (key: string, fallback: number): number => {
    const value = extras[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };
  const color = typeof extras.color === "string" ? extras.color : "#ffffff";
  const light = new THREE.PointLight(
    new THREE.Color(color),
    read("intensity", 8),
    read("distance", 12),
    read("decay", 2),
  );
  light.name = name;
  obj.getWorldPosition(light.position);
  return light;
}
