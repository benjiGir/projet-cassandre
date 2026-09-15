import * as THREE from "three";

import { configureRetroTexture } from "./renderer";

/**
 * Trousse de soin posée dans un niveau (`use_*` portant `soin`) : une boîte
 * blanche à croix verte de PHARMACIE. La croix rouge est un emblème protégé ;
 * la verte est celle de toutes les pharmacies françaises, et se lit aussi
 * bien. Même principe que `dressWeaponPickup` : la boîte grise du `.glb` ne
 * sert qu'à situer l'objet, le vrai modèle est posé à sa place.
 */

/** Largeur, hauteur, profondeur, en mètres. Assez grosse pour se voir de loin à 640×360. */
const KIT_SIZE = { width: 0.5, height: 0.32, depth: 0.36 } as const;

/** Une trousse n'est pas un néon, mais doit rester visible dans le souterrain. */
const KIT_GLOW = 0.35;

const CELL = 32;

let shared: { geometry: THREE.BoxGeometry; material: THREE.MeshLambertMaterial } | null = null;

function kitFaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CELL;
  canvas.height = CELL;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#b4b6b4";
  ctx.fillRect(0, 0, CELL, CELL);
  ctx.fillStyle = "#f2efe6";
  ctx.fillRect(2, 2, CELL - 4, CELL - 4);
  ctx.fillStyle = "#2e9e44";
  ctx.fillRect(12, 6, 8, 20);
  ctx.fillRect(6, 12, 20, 8);
  const texture = new THREE.CanvasTexture(canvas);
  configureRetroTexture(texture);
  return texture;
}

function sharedKit() {
  if (!shared) {
    const map = kitFaceTexture();
    shared = {
      geometry: new THREE.BoxGeometry(KIT_SIZE.width, KIT_SIZE.height, KIT_SIZE.depth),
      material: new THREE.MeshLambertMaterial({
        map,
        emissive: 0xffffff,
        emissiveMap: map,
        emissiveIntensity: KIT_GLOW,
      }),
    };
    // Origine à la base : le modèle se pose directement sur le sol.
    shared.geometry.translate(0, KIT_SIZE.height / 2, 0);
  }
  return shared;
}

/**
 * Remplace le rendu de la boîte `object` par une trousse, posée sur `groundY`
 * (hauteur monde du sol sous elle) ou, à défaut, sur le bas de la boîte.
 */
export function dressHealPickup(object: THREE.Object3D, groundY: number | null): void {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());

  const mesh = object as THREE.Mesh;
  if (mesh.isMesh) mesh.material = HIDDEN_MATERIAL;

  const kit = sharedKit();
  const model = new THREE.Mesh(kit.geometry, kit.material);
  model.position.set(center.x, groundY ?? box.min.y, center.z);
  // De biais : une boîte vue pile de face se lit comme un panneau plat.
  model.rotation.y = Math.PI / 7;
  object.attach(model);
}

/** Matériau jamais dessiné, pour la boîte d'un ramassage habillé. */
const HIDDEN_MATERIAL = new THREE.MeshLambertMaterial({ visible: false });
