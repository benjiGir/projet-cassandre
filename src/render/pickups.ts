import * as THREE from "three";

import { assetUrl } from "../core/assetPath";
import type { FoodItem } from "../game/level/food";
import { configureRetroTexture } from "./renderer";

// see: docs/6-reference/notes-code-rendu.md#ramassages

// Largeur, hauteur, profondeur, en mètres. Assez grosse pour se voir de loin à 640×360.
const KIT_SIZE = { width: 0.5, height: 0.32, depth: 0.36 } as const;

// Une trousse n'est pas un néon, mais doit rester visible dans le souterrain.
const KIT_GLOW = 0.35;

const AMMO_SIZE = { width: 0.42, height: 0.22, depth: 0.3 } as const;

const CELL = 32;

type FoodPart = {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshLambertMaterial;
  position: THREE.Vector3;
  rotation: THREE.Euler;
};

const foodMaterials = new Map<string, THREE.MeshLambertMaterial>();
const foodParts = new Map<FoodItem, FoodPart[]>();

function foodMaterial(color: string): THREE.MeshLambertMaterial {
  let material = foodMaterials.get(color);
  if (!material) {
    material = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.12, flatShading: true });
    foodMaterials.set(color, material);
  }
  return material;
}

function foodPart(
  geometry: THREE.BufferGeometry,
  color: string,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
): FoodPart {
  return {
    geometry,
    material: foodMaterial(color),
    position: new THREE.Vector3(...position),
    rotation: new THREE.Euler(...rotation),
  };
}

function modeleNourriture(item: FoodItem): FoodPart[] {
  const cached = foodParts.get(item);
  if (cached) return cached;

  let parts: FoodPart[];
  switch (item) {
    case "donut":
      parts = [
        foodPart(new THREE.TorusGeometry(0.14, 0.052, 6, 12), "#a95730", [0, 0.105, 0], [Math.PI / 2, 0, 0]),
        foodPart(new THREE.TorusGeometry(0.14, 0.022, 6, 12), "#e887a8", [0, 0.142, 0], [Math.PI / 2, 0, 0]),
      ];
      break;
    case "sandwich":
      parts = [
        foodPart(new THREE.BoxGeometry(0.28, 0.075, 0.20), "#d9a75d", [0, 0.055, 0]),
        foodPart(new THREE.BoxGeometry(0.29, 0.035, 0.21), "#5d9b43", [0, 0.105, 0]),
        foodPart(new THREE.BoxGeometry(0.27, 0.035, 0.19), "#c64e3c", [0, 0.14, 0]),
        foodPart(new THREE.BoxGeometry(0.28, 0.065, 0.20), "#edc27b", [0, 0.19, 0]),
      ];
      break;
    case "jambon":
      parts = [
        foodPart(new THREE.BoxGeometry(0.30, 0.055, 0.22), "#b94e58", [0, 0.045, 0]),
        foodPart(new THREE.BoxGeometry(0.28, 0.045, 0.20), "#d97878", [0.015, 0.095, -0.005]),
        foodPart(new THREE.BoxGeometry(0.24, 0.025, 0.035), "#f0d6b8", [-0.01, 0.13, 0.01]),
      ];
      break;
    case "poulet": {
      const drumstick = new THREE.CapsuleGeometry(0.033, 0.105, 2, 6);
      const bone = new THREE.SphereGeometry(0.035, 6, 4);
      parts = [
        foodPart(new THREE.SphereGeometry(1, 10, 6), "#b9602e", [0, 0.145, 0]),
        foodPart(new THREE.SphereGeometry(1, 8, 5), "#cf7434", [-0.105, 0.12, 0.015]),
        foodPart(drumstick, "#a74d27", [-0.15, 0.085, 0], [0, 0, -1.1]),
        foodPart(drumstick, "#a74d27", [0.15, 0.085, 0], [0, 0, 1.1]),
        foodPart(bone, "#f1dfbd", [-0.23, 0.115, 0]),
        foodPart(bone, "#f1dfbd", [0.23, 0.115, 0]),
      ];
      parts[0].geometry.scale(0.19, 0.13, 0.15);
      parts[1].geometry.scale(0.11, 0.09, 0.11);
      break;
    }
    case "pizza": {
      const toppings = [[-0.08, 0.115, -0.055], [0.045, 0.115, -0.07], [0.09, 0.115, 0.035], [-0.045, 0.115, 0.075]] as const;
      parts = [
        foodPart(new THREE.CylinderGeometry(0.205, 0.205, 0.065, 12), "#bd6b34", [0, 0.04, 0]),
        foodPart(new THREE.CylinderGeometry(0.177, 0.177, 0.018, 12), "#edc34e", [0, 0.081, 0]),
        ...toppings.map((position) =>
          foodPart(new THREE.SphereGeometry(0.027, 6, 4), "#b63d34", [position[0], position[1], position[2]]),
        ),
      ];
      break;
    }
  }
  foodParts.set(item, parts);
  return parts;
}

export function dressFoodPickup(object: THREE.Object3D, groundY: number | null, item: FoodItem): void {
  const bounds = new THREE.Box3().setFromObject(object);
  const center = bounds.getCenter(new THREE.Vector3());
  const marker = object as THREE.Mesh;
  if (marker.isMesh) marker.material = HIDDEN_MATERIAL;

  const model = new THREE.Group();
  model.position.set(center.x, groundY ?? bounds.min.y, center.z);
  for (const part of modeleNourriture(item)) {
    const mesh = new THREE.Mesh(part.geometry, part.material);
    mesh.position.copy(part.position);
    mesh.rotation.copy(part.rotation);
    model.add(mesh);
  }
  object.attach(model);
}

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

    shared.geometry.translate(0, KIT_SIZE.height / 2, 0);
  }
  return shared;
}

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

function poser(object: THREE.Object3D, modele: ModeleRamassage, groundY: number | null): void {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());

  const mesh = object as THREE.Mesh;
  if (mesh.isMesh) mesh.material = HIDDEN_MATERIAL;

  const model = new THREE.Mesh(modele.geometry, modele.material);
  model.position.set(center.x, groundY ?? box.min.y, center.z);

  model.rotation.y = Math.PI / 7;
  object.attach(model);
}

export function dressHealPickup(object: THREE.Object3D, groundY: number | null): void {
  poser(object, sharedKit(), groundY);
}

export function dressAmmoPickup(object: THREE.Object3D, groundY: number | null): void {
  poser(object, sharedAmmoBox(), groundY);
}

// Matériau jamais dessiné, pour la boîte d'un ramassage habillé.
const HIDDEN_MATERIAL = new THREE.MeshLambertMaterial({ visible: false });


export type PickupWeaponKind = "melee" | "pistol" | "shotgun";

// Resynchroniser les rectangles avec weapon_pickups.json après génération de l’atlas.
const WEAPON_ICON_ATLAS_URL = "assets/sprites/weapon_pickups.png";
const WEAPON_ICON_ATLAS_SIZE = { width: 159, height: 72 };
const WEAPON_ICON_RECTS: Record<PickupWeaponKind, { x: number; y: number; width: number; height: number }> = {
  melee: { x: 0, y: 0, width: 56, height: 56 },
  pistol: { x: 58, y: 0, width: 27, height: 27 },
  shotgun: { x: 87, y: 0, width: 72, height: 72 },
};

const WEAPON_SPRITE_SIZE: Record<PickupWeaponKind, number> = {
  melee: 0.8,
  pistol: 0.8,
  shotgun: 1.1,
};

const WEAPON_BOB_AMPLITUDE = 0.08; // m — relevé (0,05 -> 0,08) : invisible à distance sinon, retour de vérification
const WEAPON_BOB_SPEED = 2.1; // rad/s
const WEAPON_GLOW_MIN = 0.55;
const WEAPON_GLOW_MAX = 1.3;
const WEAPON_GLOW_SPEED = 1.4; // rad/s, déphasé du bob : ne se lit pas comme un clignotement mécanique

let sharedWeaponAtlas: THREE.Texture | null = null;
let sharedWeaponSpriteMaterial: THREE.MeshLambertMaterial | null = null;
const sharedWeaponSpriteGeometries = new Map<PickupWeaponKind, THREE.PlaneGeometry>();

function weaponIconAtlas(): THREE.Texture {
  if (sharedWeaponAtlas) return sharedWeaponAtlas;
  // Configurer après arrivée de l’image : needsUpdate déclencherait sinon un upload vide.
  const texture = new THREE.TextureLoader().load(assetUrl(WEAPON_ICON_ATLAS_URL), () =>
    configureRetroTexture(texture),
  );
  sharedWeaponAtlas = texture;
  return texture;
}

function weaponSpriteMaterial(): THREE.MeshLambertMaterial {
  if (!sharedWeaponSpriteMaterial) {
    const atlas = weaponIconAtlas();
    sharedWeaponSpriteMaterial = new THREE.MeshLambertMaterial({
      map: atlas,
      emissive: 0xffffff,
      emissiveMap: atlas,
      emissiveIntensity: WEAPON_GLOW_MIN,
      alphaTest: 0.5,
      transparent: false, // contrat du skill : écrit dans le depth buffer, pas de tri de profondeur
      depthWrite: true,
    });
  }
  return sharedWeaponSpriteMaterial;
}

// PlaneGeometry porte des UV de coins exacts, 0 ou 1.
function bakeIconRectUv(geometry: THREE.PlaneGeometry, rect: { x: number; y: number; width: number; height: number }): void {
  const u0 = rect.x / WEAPON_ICON_ATLAS_SIZE.width;
  const u1 = (rect.x + rect.width) / WEAPON_ICON_ATLAS_SIZE.width;
  // V inversé : le haut de l’image correspond à v=1.
  const v1 = 1 - rect.y / WEAPON_ICON_ATLAS_SIZE.height;
  const v0 = 1 - (rect.y + rect.height) / WEAPON_ICON_ATLAS_SIZE.height;
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) < 0.5 ? u0 : u1, uv.getY(i) < 0.5 ? v0 : v1);
  }
  uv.needsUpdate = true;
}

function weaponSpriteGeometry(weapon: PickupWeaponKind): THREE.PlaneGeometry {
  const cached = sharedWeaponSpriteGeometries.get(weapon);
  if (cached) return cached;
  const size = WEAPON_SPRITE_SIZE[weapon];
  const geometry = new THREE.PlaneGeometry(size, size);
  bakeIconRectUv(geometry, WEAPON_ICON_RECTS[weapon]);
  sharedWeaponSpriteGeometries.set(weapon, geometry);
  return geometry;
}

// Matériau partagé : avancer cette horloge une fois par frame, jamais par pickup.
let weaponPickupClock = 0;

export function advanceWeaponPickupClock(realDt: number): void {
  weaponPickupClock += realDt;
  if (!sharedWeaponSpriteMaterial) return; // aucun pickup dressé cette partie : rien à faire tourner
  sharedWeaponSpriteMaterial.emissiveIntensity =
    WEAPON_GLOW_MIN + (WEAPON_GLOW_MAX - WEAPON_GLOW_MIN) * (0.5 + 0.5 * Math.sin(weaponPickupClock * WEAPON_GLOW_SPEED));
}

export class WeaponPickupBillboard {
  readonly spriteMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;

  // Position LOCALE de repos (sans flottement), capturée après `attachTo` — voir sa doc.
  private baseLocalY = 0;
  // Déphasage du flottement, déterministe (dérivé de la position, PAS du RNG — purement cosmétique, hors invariant #12) : les trois pickups ne flottent pas en phase.
  private readonly bobPhase: number;
  private readonly scratchWorldPos = new THREE.Vector3();

  constructor(weapon: PickupWeaponKind, worldPosition: THREE.Vector3) {
    this.spriteMesh = new THREE.Mesh(weaponSpriteGeometry(weapon), weaponSpriteMaterial());
    // Position MONDE, posée avant tout rattachement — `attachTo` la convertit
    // en repère local et capture `baseLocalY` à ce moment-là, jamais ici.
    this.spriteMesh.position.set(worldPosition.x, worldPosition.y + WEAPON_SPRITE_SIZE[weapon] / 2, worldPosition.z);

    this.bobPhase = ((worldPosition.x * 12.9898 + worldPosition.z * 78.233) % 1) * Math.PI * 2;
  }

  // Capturer la hauteur locale après attach, jamais la hauteur mondiale du constructeur.
  attachTo(parent: THREE.Object3D): void {
    parent.attach(this.spriteMesh);
    this.baseLocalY = this.spriteMesh.position.y;
  }

  update(camera: THREE.Camera): void {
    const bob = Math.sin(weaponPickupClock * WEAPON_BOB_SPEED + this.bobPhase) * WEAPON_BOB_AMPLITUDE;
    this.spriteMesh.position.y = this.baseLocalY + bob;

    // Le mesh est enfant du repère glTF : calculer le cap avec sa position mondiale.
    this.spriteMesh.getWorldPosition(this.scratchWorldPos);
    const dx = camera.position.x - this.scratchWorldPos.x;
    const dz = camera.position.z - this.scratchWorldPos.z;
    this.spriteMesh.rotation.y = Math.atan2(dx, dz);
  }
}

export function dressWeaponPickup(
  object: THREE.Object3D,
  weapon: PickupWeaponKind,
  groundY: number | null,
): WeaponPickupBillboard {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());

  const mesh = object as THREE.Mesh;
  if (mesh.isMesh) mesh.material = HIDDEN_MATERIAL;

  const billboard = new WeaponPickupBillboard(weapon, new THREE.Vector3(center.x, groundY ?? box.min.y, center.z));
  billboard.attachTo(object);
  return billboard;
}
