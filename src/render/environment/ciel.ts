import * as THREE from "three";

import { assetUrl } from "../../core/loading/assetPath";

// see: docs/6-reference/notes-code-rendu.md#renderer-et-ciel

const FACES = ["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"];

const loaded = new Map<string, THREE.CubeTexture>();

export function loadSky(name: string): THREE.CubeTexture {
  const cached = loaded.get(name);
  if (cached) return cached;
  const texture = new THREE.CubeTextureLoader().load(FACES.map((f) => assetUrl(`assets/sky/${name}/${f}`)));
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  loaded.set(name, texture);
  return texture;
}
