import * as THREE from "three";

import { configureRetroTexture } from "./renderer";

/**
 * Ramassages posés au sol et pris en marchant dessus : trousse de soin
 * (`use_*` portant `soin`) et boîte de munitions (`munitions`). Même principe
 * que `dressWeaponPickup` : la boîte grise du `.glb` ne sert qu'à situer
 * l'objet, le vrai modèle est posé à sa place.
 *
 * La trousse porte une croix verte de PHARMACIE : la croix rouge est un
 * emblème protégé, la verte est celle de toutes les pharmacies françaises et
 * se lit aussi bien.
 */

/** Largeur, hauteur, profondeur, en mètres. Assez grosse pour se voir de loin à 640×360. */
const KIT_SIZE = { width: 0.5, height: 0.32, depth: 0.36 } as const;

/** Une trousse n'est pas un néon, mais doit rester visible dans le souterrain. */
const KIT_GLOW = 0.35;

/** Caisse de munitions : plus basse et plus large qu'une trousse, pour s'en distinguer d'un coup d'œil. */
const AMMO_SIZE = { width: 0.42, height: 0.22, depth: 0.3 } as const;

const CELL = 32;

interface ModeleRamassage {
  geometry: THREE.BoxGeometry;
  material: THREE.MeshLambertMaterial;
}

let shared: ModeleRamassage | null = null;
let sharedAmmo: ModeleRamassage | null = null;

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

function sharedKit(): ModeleRamassage {
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

/** Face d'une caisse de munitions : olive, cerclée, avec trois balles peintes. */
function ammoFaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CELL;
  canvas.height = CELL;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#39412a";
  ctx.fillRect(0, 0, CELL, CELL);
  ctx.fillStyle = "#4d5836";
  ctx.fillRect(2, 2, CELL - 4, CELL - 4);
  ctx.fillStyle = "#111014";
  ctx.fillRect(0, 13, CELL, 3);
  ctx.fillStyle = "#f2c230"; // trois balles : le seul motif reconnaissable à 640×360
  for (const x of [8, 14, 20]) {
    ctx.fillRect(x, 20, 4, 7);
    ctx.fillRect(x, 18, 4, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  configureRetroTexture(texture);
  return texture;
}

function sharedAmmoBox(): ModeleRamassage {
  if (!sharedAmmo) {
    const map = ammoFaceTexture();
    sharedAmmo = {
      geometry: new THREE.BoxGeometry(AMMO_SIZE.width, AMMO_SIZE.height, AMMO_SIZE.depth),
      material: new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.2 }),
    };
    sharedAmmo.geometry.translate(0, AMMO_SIZE.height / 2, 0);
  }
  return sharedAmmo;
}

/** Pose `modele` à la place de la boîte `object`, sur `groundY` ou, à défaut, sur le bas de la boîte. */
function poser(object: THREE.Object3D, modele: ModeleRamassage, groundY: number | null): void {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());

  const mesh = object as THREE.Mesh;
  if (mesh.isMesh) mesh.material = HIDDEN_MATERIAL;

  const model = new THREE.Mesh(modele.geometry, modele.material);
  model.position.set(center.x, groundY ?? box.min.y, center.z);
  // De biais : une boîte vue pile de face se lit comme un panneau plat.
  model.rotation.y = Math.PI / 7;
  object.attach(model);
}

/** Trousse de soin (`use_*` portant `soin`). */
export function dressHealPickup(object: THREE.Object3D, groundY: number | null): void {
  poser(object, sharedKit(), groundY);
}

/** Boîte de munitions (`use_*` portant `munitions`). */
export function dressAmmoPickup(object: THREE.Object3D, groundY: number | null): void {
  poser(object, sharedAmmoBox(), groundY);
}

/** Matériau jamais dessiné, pour la boîte d'un ramassage habillé. */
const HIDDEN_MATERIAL = new THREE.MeshLambertMaterial({ visible: false });
