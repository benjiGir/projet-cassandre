import * as THREE from "three";

export const INTERNAL_WIDTH = 640;
export const INTERNAL_HEIGHT = 360;

/**
 * Comment une texture est filtrée quand elle est RÉDUITE (vue de loin).
 *
 * L'agrandissement, lui, ne se discute pas : `magFilter` reste
 * `NearestFilter` dans les trois modes. C'est lui qui fait le gros pixel franc
 * de près, et c'est ça, le look du jeu (invariant #4).
 *
 * - `nearest` : réglage historique — aucun mipmap, `NearestFilter` aussi en
 *   réduction. Une texture de 128 px qui ne couvre plus que trois pixels à
 *   l'écran y échantillonne un texel presque au hasard : le résultat grésille
 *   et rampe dès que la caméra bouge. Ce n'est pas du cachet rétro, c'est du
 *   crénelage.
 * - `mipmap` : mipmaps générés, réduction en `NearestMipmapLinear`. Le niveau
 *   de mip est interpolé (donc pas de saut visible d'un niveau à l'autre) mais
 *   le texel reste pris au plus proche.
 * - `aniso` : idem, plus le filtrage anisotrope maximal de la machine. C'est
 *   ce qui compte pour les SOLS, vus en fuyante : un sol rasant est le pire
 *   cas du mipmap classique, qui le floute d'un coup.
 *
 * see: docs/systems/rendu.md#filtrage-des-textures
 */
export type FiltrageTexture = "nearest" | "mipmap" | "aniso";

/** Réglage courant, appliqué à toute texture configurée ensuite. */
let filtrage: FiltrageTexture = "aniso";
/** Rempli à la création du renderer : dépend de la machine (souvent 16). */
let anisotropieMax = 1;

export function filtrageCourant(): FiltrageTexture {
  return filtrage;
}

export function anisotropieDisponible(): number {
  return anisotropieMax;
}

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.setSize(INTERNAL_WIDTH, INTERNAL_HEIGHT, false); // false: ne touche pas au style CSS
  renderer.setClearColor(0x1a1a1a);
  anisotropieMax = renderer.capabilities.getMaxAnisotropy();
  return renderer;
}

/** Applique le look rétro à une texture : gros pixel de près, réduction selon `filtrage`. */
export function configureRetroTexture(texture: THREE.Texture, mode: FiltrageTexture = filtrage) {
  // Non négociable dans les trois modes : c'est l'agrandissement qui porte le look.
  texture.magFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  if (mode === "nearest") {
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = 1;
  } else {
    texture.minFilter = THREE.NearestMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = mode === "aniso" ? anisotropieMax : 1;
  }
  texture.needsUpdate = true;
}

/**
 * Rebascule TOUTES les textures déjà chargées d'une scène sur un autre mode.
 *
 * Sert à comparer en jeu, sur la même vue, sans recharger le niveau — la seule
 * façon honnête de juger un défaut qui ne se voit qu'en mouvement. Les textures
 * sont dédupliquées par identité : un atlas partagé par cinquante meshes n'est
 * réuploadé qu'une fois.
 */
export function appliquerFiltrage(scene: THREE.Object3D, mode: FiltrageTexture): number {
  filtrage = mode;
  const vues = new Set<THREE.Texture>();
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const map = (mat as THREE.MeshLambertMaterial).map;
      if (map) vues.add(map);
    }
  });
  for (const texture of vues) configureRetroTexture(texture, mode);
  return vues.size;
}

/**
 * Change la résolution de rendu INTERNE (celle qui est ensuite étirée à
 * l'écran), en conservant le rapport d'image de la caméra.
 *
 * Outil de comparaison, pas un réglage de jeu : `INTERNAL_WIDTH`/`_HEIGHT`
 * restent la valeur de l'invariant #4, et les overlays 2D (réticule,
 * hitmarker) gardent leur propre taille — ils ne suivent pas.
 */
export function setResolutionInterne(
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
