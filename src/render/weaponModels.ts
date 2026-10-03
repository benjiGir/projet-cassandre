import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Schema } from "effect";

import { assetUrl } from "../core/assetPath";
import type { WeaponModels } from "./viewmodelTypes";

const decodeVector = Schema.decodeUnknownSync(Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]));

function vec3(value: unknown, name: string): THREE.Vector3 {
  try {
    const [x, y, z] = decodeVector(value);
    return new THREE.Vector3(x, y, z);
  } catch (cause) {
    throw new Error(`[armes] extra "${name}" absent ou mal formé`, { cause });
  }
}

function disposeImportedMaterials(scene: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  // Le viewmodel ne reprend que les géométries ; aucune texture glTF n'est réutilisée.
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}

// Frontière asynchrone au démarrage ; repli si nœuds ou extras manquent.
export async function loadWeaponModels(): Promise<WeaponModels> {
  const gltf = await new GLTFLoader().loadAsync(assetUrl("assets/weapons/armes.glb"));
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const geometries = new Set<THREE.BufferGeometry>();
  gltf.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) geometries.add(object.geometry);
  });
  try {
    // Le nom Blender et les extras peuvent vivre sur le groupe homonyme du mesh.
    const byName = new Map<string, THREE.Object3D[]>();
    gltf.scene.traverse((obj) => {
      const name = (obj.userData.name as string | undefined) ?? obj.name;
      byName.set(name, [...(byName.get(name) ?? []), obj]);
    });
    const node = (name: string): THREE.Mesh => {
      const mesh = byName.get(name)?.find((obj) => (obj as THREE.Mesh).isMesh) as THREE.Mesh | undefined;
      if (!mesh) throw new Error(`[armes] nœud "${name}" absent de armes.glb`);
      return mesh;
    };
    const extra = (name: string, key: string): unknown => byName.get(name)?.find((obj) => key in obj.userData)?.userData[key];

    const crowbar = node("vm_crowbar");
    const pistol = node("vm_pistol");
    const shotgun = node("vm_shotgun");
    const pump = node("vm_shotgun_pump");

    const models: WeaponModels = {
      crowbar: crowbar.geometry,
      pistol: pistol.geometry,
      shotgun: shotgun.geometry,
      shotgunPump: pump.geometry,
      worldCrowbar: node("world_crowbar").geometry,
      worldPistol: node("world_pistol").geometry,
      worldShotgun: node("world_shotgun").geometry,
      crowbarPivot: vec3(extra("vm_crowbar", "prise"), "vm_crowbar.prise"),
      pistolPivot: vec3(extra("vm_pistol", "prise"), "vm_pistol.prise"),
      pistolMuzzle: vec3(extra("vm_pistol", "bout_canon"), "vm_pistol.bout_canon"),
      shotgunPivot: vec3(extra("vm_shotgun", "prise"), "vm_shotgun.prise"),
      shotgunMuzzle: vec3(extra("vm_shotgun", "bout_canon"), "vm_shotgun.bout_canon"),
      pumpAxis: vec3(extra("vm_shotgun_pump", "axe_glissiere"), "vm_shotgun_pump.axe_glissiere").normalize(),
      material,
    };
    for (const geometry of [models.crowbar, models.pistol, models.shotgun, models.shotgunPump, models.worldCrowbar, models.worldPistol, models.worldShotgun]) {
      geometries.delete(geometry);
    }
    return models;
  } catch (error) {
    material.dispose();
    throw error;
  } finally {
    disposeImportedMaterials(gltf.scene);
    for (const geometry of geometries) geometry.dispose();
  }
}

function coloredBox(size: [number, number, number], center: [number, number, number], color: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(...size).translate(...center);
  const c = new THREE.Color(color);
  const colors = new Float32Array(geometry.attributes.position!.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function placeholderWeaponModels(): WeaponModels {
  return {
    crowbar: coloredBox([0.06, 0.06, 0.7], [0.32, -0.28, -0.55], 0x8a5a34),
    pistol: coloredBox([0.06, 0.1, 0.26], [0.26, -0.26, -0.45], 0x3a3d44),
    shotgun: coloredBox([0.09, 0.12, 0.85], [0.3, -0.3, -0.65], 0x555a60),
    shotgunPump: coloredBox([0.001, 0.001, 0.001], [0.3, -0.3, -0.65], 0x555a60),
    worldCrowbar: coloredBox([0.03, 0.03, 0.7], [0, 0.015, 0], 0x8a5a34),
    worldPistol: coloredBox([0.04, 0.05, 0.22], [0, 0.025, 0], 0x3a3d44),
    worldShotgun: coloredBox([0.05, 0.05, 0.8], [0, 0.025, 0], 0x555a60),
    crowbarPivot: new THREE.Vector3(0.32, -0.28, -0.4),
    pistolPivot: new THREE.Vector3(0.26, -0.26, -0.32),
    pistolMuzzle: new THREE.Vector3(0.26, -0.22, -0.6),
    shotgunPivot: new THREE.Vector3(0.3, -0.3, -0.4),
    shotgunMuzzle: new THREE.Vector3(0.3, -0.25, -1.05),
    pumpAxis: new THREE.Vector3(0, 0, -1),
    material: new THREE.MeshLambertMaterial({ vertexColors: true }),
  };
}

export async function loadWeaponModelsOrPlaceholder(): Promise<WeaponModels> {
  try {
    return await loadWeaponModels();
  } catch (error) {
    console.error("[armes] armes.glb illisible, repli sur les boîtes", error);
    return placeholderWeaponModels();
  }
}
