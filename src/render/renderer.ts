import * as THREE from "three";

export const INTERNAL_WIDTH = 640;
export const INTERNAL_HEIGHT = 360;

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.setSize(INTERNAL_WIDTH, INTERNAL_HEIGHT, false); // false: ne touche pas au style CSS
  renderer.setClearColor(0x1a1a1a);
  return renderer;
}

/** Applique le look rétro (pas de filtrage bilinéaire, pas de mipmaps) à une texture. */
export function configureRetroTexture(texture: THREE.Texture) {
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
}
