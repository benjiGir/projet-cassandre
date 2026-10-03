import * as THREE from "three";

/** Un TextureNode TSL et un uniforme ShaderMaterial exposent leur entrée par `value`. */
export type TextureInput = THREE.Texture | { readonly value: unknown };

const configured = new Set<THREE.Texture>();
const materialInputs = new Map<THREE.Material, readonly TextureInput[]>();

export function registerRetroTexture(texture: THREE.Texture): void {
  if (configured.has(texture) || !configurable(texture)) return;
  configured.add(texture);
  const release = (): void => {
    configured.delete(texture);
    texture.removeEventListener("dispose", release);
  };
  texture.addEventListener("dispose", release);
}

/** Enregistrer les TextureNodes/uniformes dont la valeur peut changer, pas leur valeur initiale seule. */
export function registerMaterialTextureInputs(material: THREE.Material, inputs: readonly TextureInput[]): void {
  if (!materialInputs.has(material)) {
    const release = (): void => {
      materialInputs.delete(material);
      material.removeEventListener("dispose", release);
    };
    material.addEventListener("dispose", release);
  }
  materialInputs.set(material, [...inputs]);
}

function configurable(texture: THREE.Texture): boolean {
  // Les buffers d'effet et le ciel ont leur propre contrat de filtrage.
  return !texture.isRenderTargetTexture && !(texture instanceof THREE.DepthTexture) && !(texture instanceof THREE.CubeTexture);
}

function addTexture(value: unknown, textures: Set<THREE.Texture>): void {
  if (value instanceof THREE.Texture) {
    if (configurable(value)) textures.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) addTexture(item, textures);
  }
}

export function collectRetroTextures(scene: THREE.Object3D): Set<THREE.Texture> {
  const textures = new Set(configured);
  const materials = new Set<THREE.Material>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const material of materials) {
    // Canaux classiques : map, normalMap, emissiveMap, alphaMap, roughnessMap…
    for (const value of Object.values(material)) addTexture(value, textures);
    if (material instanceof THREE.ShaderMaterial) {
      for (const uniform of Object.values(material.uniforms)) addTexture(uniform.value, textures);
    }
  }
  // Entrées TSL explicites : pas de parcours récursif arbitraire du graphe de nodes.
  for (const inputs of materialInputs.values()) {
    for (const input of inputs) addTexture(input instanceof THREE.Texture ? input : input.value, textures);
  }
  return textures;
}
