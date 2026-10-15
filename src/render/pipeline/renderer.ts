import * as THREE from "three";
import { WebGLNodesHandler } from "three/addons/tsl/WebGLNodesHandler.js";

import { collectRetroTextures, registerRetroTexture } from "./textureRegistry";

export const INTERNAL_WIDTH = 640;
export const INTERNAL_HEIGHT = 360;

// see: docs/6-reference/notes-code-rendu.md#renderer-et-ciel
export type TextureFiltering = "nearest" | "mipmap" | "aniso";

let filtering: TextureFiltering = "aniso";

let maxAnisotropy = 1;

export function availableAnisotropy(): number {
  return maxAnisotropy;
}

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setNodesHandler(new WebGLNodesHandler());
  renderer.setPixelRatio(1);
  renderer.setSize(INTERNAL_WIDTH, INTERNAL_HEIGHT, false); // false: ne touche pas au style CSS
  renderer.setClearColor(0x1a1a1a);
  maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  return renderer;
}

function configureTextureFiltering(texture: THREE.Texture, mode: TextureFiltering): void {
  // Nearest à l’agrandissement porte le gros pixel dans tous les modes.
  texture.magFilter = THREE.NearestFilter;
  if (mode === "nearest") {
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = 1;
  } else {
    texture.minFilter = THREE.NearestMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = mode === "aniso" ? maxAnisotropy : 1;
  }
  texture.needsUpdate = true;
  registerRetroTexture(texture);
}

export function configureRetroTexture(texture: THREE.Texture, mode: TextureFiltering = filtering): void {
  texture.colorSpace = THREE.SRGBColorSpace;
  configureTextureFiltering(texture, mode);
}

export function applyTextureFiltering(scene: THREE.Object3D, mode: TextureFiltering): number {
  filtering = mode;
  const vues = collectRetroTextures(scene);
  for (const texture of vues) {
    // Un canal normal/alpha n'est pas une couleur sRGB : conserver son encodage.
    configureTextureFiltering(texture, mode);
  }
  return vues.size;
}

export function setInternalResolution(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
): { width: number; height: number } {
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  return { width, height };
}
