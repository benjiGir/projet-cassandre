import * as THREE from "three";

import { assetUrl } from "../core/assetPath";

// see: docs/6-reference/notes-code-rendu.md#renderer-et-ciel

const FACES = ["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"];

const charges = new Map<string, THREE.CubeTexture>();

export function chargerCiel(nom: string): THREE.CubeTexture {
  const deja = charges.get(nom);
  if (deja) return deja;
  const texture = new THREE.CubeTextureLoader().load(FACES.map((f) => assetUrl(`assets/sky/${nom}/${f}`)));
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  charges.set(nom, texture);
  return texture;
}
