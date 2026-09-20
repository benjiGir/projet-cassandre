import * as THREE from "three";

import { assetUrl } from "../core/assetPath";

/**
 * Ciel d'un niveau : une cubemap posée en `scene.background`.
 *
 * Pas un mesh ni un matériau : three.js dessine le fond avec son propre
 * shader, en un seul appel, derrière tout le reste — l'invariant #5 (Lambert
 * seulement) porte sur les matériaux du monde, qu'aucun ciel ne touche. Le
 * ciel ne se voit que là où rien n'est dessiné : le parking extérieur, à ciel
 * ouvert, et les verrières de la galerie.
 *
 * Filtré au plus proche dans les deux sens (invariant #4) et sans mipmaps : un
 * ciel n'est jamais vu en fuyante, il n'a pas le défaut de réduction que
 * l'ADR 0027 corrige sur les sols.
 *
 * Les six faces sont générées par `tools/textures/generate_ciel.py` dans
 * `public/assets/sky/<nom>/`.
 * see: docs/systems/rendu.md#ciel
 */

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
