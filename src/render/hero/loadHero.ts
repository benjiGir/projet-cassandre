import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { assetUrl } from "../../core/loading/assetPath";
import { applyMinimumLight } from "../materials/minimumLight";
import type { HeroAsset } from "./heroTypes";

export async function loadHero(): Promise<HeroAsset> {
  const gltf = await new GLTFLoader().loadAsync(assetUrl("assets/characters/hero.glb"));
  const converted = new Map<THREE.Material, THREE.MeshLambertMaterial>();
  gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const convert = (original: THREE.Material): THREE.MeshLambertMaterial => {
      const existing = converted.get(original);
      if (existing) return existing;
      const source = original as THREE.MeshStandardMaterial;
      const material = new THREE.MeshLambertMaterial({
        color: source.color,
        map: source.map,
        vertexColors: source.vertexColors,
        side: source.side,
      });
      if (material.map) {
        material.map.magFilter = THREE.NearestFilter;
        material.map.minFilter = THREE.LinearMipmapLinearFilter;
        material.map.generateMipmaps = true;
        material.map.needsUpdate = true;
      }
      applyMinimumLight(material, 0.32);
      converted.set(original, material);
      original.dispose();
      return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
    // La boîte de repos ne couvre pas un pied lancé ou un bras qui frappe.
    object.frustumCulled = false;
  });
  return { root: gltf.scene, animations: gltf.animations };
}
