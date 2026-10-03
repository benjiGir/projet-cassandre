import * as THREE from "three";

import { assetUrl } from "../../core/loading/assetPath";
import type { FoodItem } from "../../game/level/interactions/food";
import { FOOD_ITEMS } from "../../game/level/interactions/food";
import { configureRetroTexture } from "../pipeline/renderer";
import type { PickupWeaponKind, FoodPart, PickupModel } from "./pickupTypes";
import {
  WEAPON_ICON_ATLAS_URL,
  WEAPON_ICON_ATLAS_SIZE,
  WEAPON_ICON_RECTS,
  WEAPON_SPRITE_SIZE,
  WEAPON_GLOW_MIN,
  WEAPON_GLOW_MAX,
  WEAPON_GLOW_SPEED,
} from "./pickupConfig";

// Largeur, hauteur, profondeur, en mètres. Assez grosse pour se voir de loin à 640×360.
const KIT_SIZE = { width: 0.5, height: 0.32, depth: 0.36 } as const;

// Une trousse n'est pas un néon, mais doit rester visible dans le souterrain.
const KIT_GLOW = 0.35;

const AMMO_SIZE = { width: 0.42, height: 0.22, depth: 0.3 } as const;

const CELL = 32;

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

export class PickupResources {
  private readonly owned = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
  private readonly foodMaterials = new Map<string, THREE.MeshLambertMaterial>();
  private readonly foodParts = new Map<FoodItem, FoodPart[]>();
  private readonly weaponGeometries = new Map<PickupWeaponKind, THREE.PlaneGeometry>();
  private kit: PickupModel | null = null;
  private ammo: PickupModel | null = null;
  private disposed = false;
  private clock = 0;
  get weaponClock(): number { return this.clock; }
  readonly hiddenMaterial: THREE.MeshLambertMaterial;
  readonly weaponMaterial: THREE.MeshLambertMaterial;

  constructor(atlas: THREE.Texture) {
    this.own(atlas);
    try {
      this.hiddenMaterial = this.own(new THREE.MeshLambertMaterial({ visible: false }));
      this.weaponMaterial = this.own(new THREE.MeshLambertMaterial({
        map: atlas,
        emissive: 0xffffff,
        emissiveMap: atlas,
        emissiveIntensity: WEAPON_GLOW_MIN,
        alphaTest: 0.5,
        transparent: false,
        depthWrite: true,
      }));
      this.healModel();
      this.ammoModel();
      for (const item of FOOD_ITEMS) this.foodModel(item);
      for (const weapon of ["melee", "pistol", "shotgun"] as const) this.weaponGeometry(weapon);
    } catch (error) {
      try { this.dispose(); } catch (releaseError) {
        throw new AggregateError([error, releaseError], "Préparation des ressources des ramassages interrompue");
      }
      throw error;
    }
  }

  private own<T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(resource: T): T {
    resource.userData.pickupResourcesOwned = true;
    this.owned.add(resource);
    return resource;
  }

  private assertActive(): void {
    if (this.disposed) throw new Error("Ressources des ramassages déjà libérées");
  }

  warmTextures(renderer: THREE.WebGLRenderer): void {
    this.assertActive();
    for (const resource of this.owned) {
      if (resource instanceof THREE.Texture) renderer.initTexture(resource);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const errors: unknown[] = [];
    for (const resource of this.owned) {
      try { resource.dispose(); } catch (error) { errors.push(error); }
    }
    this.owned.clear();
    this.foodMaterials.clear();
    this.foodParts.clear();
    this.weaponGeometries.clear();
    this.kit = null;
    this.ammo = null;
    if (errors.length > 0) throw new AggregateError(errors, "Libération incomplète des ressources des ramassages");
  }

  private foodMaterial(color: string): THREE.MeshLambertMaterial {
    let material = this.foodMaterials.get(color);
    if (!material) {
      material = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.12, flatShading: true });
      this.own(material);
      this.foodMaterials.set(color, material);
    }
    return material;
  }

  private foodPart(
    geometry: THREE.BufferGeometry,
    color: string,
    position: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
  ): FoodPart {
    return {
      geometry: this.own(geometry),
      material: this.foodMaterial(color),
      position: new THREE.Vector3(...position),
      rotation: new THREE.Euler(...rotation),
    };
  }

  foodModel(item: FoodItem): FoodPart[] {
    this.assertActive();
    const cached = this.foodParts.get(item);
    if (cached) return cached;

    let parts: FoodPart[];
    switch (item) {
      case "donut":
        parts = [
          this.foodPart(new THREE.TorusGeometry(0.14, 0.052, 6, 12), "#a95730", [0, 0.105, 0], [Math.PI / 2, 0, 0]),
          this.foodPart(new THREE.TorusGeometry(0.14, 0.022, 6, 12), "#e887a8", [0, 0.142, 0], [Math.PI / 2, 0, 0]),
        ];
        break;
      case "sandwich":
        parts = [
          this.foodPart(new THREE.BoxGeometry(0.28, 0.075, 0.20), "#d9a75d", [0, 0.055, 0]),
          this.foodPart(new THREE.BoxGeometry(0.29, 0.035, 0.21), "#5d9b43", [0, 0.105, 0]),
          this.foodPart(new THREE.BoxGeometry(0.27, 0.035, 0.19), "#c64e3c", [0, 0.14, 0]),
          this.foodPart(new THREE.BoxGeometry(0.28, 0.065, 0.20), "#edc27b", [0, 0.19, 0]),
        ];
        break;
      case "jambon":
        parts = [
          this.foodPart(new THREE.BoxGeometry(0.30, 0.055, 0.22), "#b94e58", [0, 0.045, 0]),
          this.foodPart(new THREE.BoxGeometry(0.28, 0.045, 0.20), "#d97878", [0.015, 0.095, -0.005]),
          this.foodPart(new THREE.BoxGeometry(0.24, 0.025, 0.035), "#f0d6b8", [-0.01, 0.13, 0.01]),
        ];
        break;
      case "poulet": {
        const drumstick = new THREE.CapsuleGeometry(0.033, 0.105, 2, 6);
        const bone = new THREE.SphereGeometry(0.035, 6, 4);
        parts = [
          this.foodPart(new THREE.SphereGeometry(1, 10, 6), "#b9602e", [0, 0.145, 0]),
          this.foodPart(new THREE.SphereGeometry(1, 8, 5), "#cf7434", [-0.105, 0.12, 0.015]),
          this.foodPart(drumstick, "#a74d27", [-0.15, 0.085, 0], [0, 0, -1.1]),
          this.foodPart(drumstick, "#a74d27", [0.15, 0.085, 0], [0, 0, 1.1]),
          this.foodPart(bone, "#f1dfbd", [-0.23, 0.115, 0]),
          this.foodPart(bone, "#f1dfbd", [0.23, 0.115, 0]),
        ];
        parts[0].geometry.scale(0.19, 0.13, 0.15);
        parts[1].geometry.scale(0.11, 0.09, 0.11);
        break;
      }
      case "pizza": {
        const toppings = [[-0.08, 0.115, -0.055], [0.045, 0.115, -0.07], [0.09, 0.115, 0.035], [-0.045, 0.115, 0.075]] as const;
        parts = [
          this.foodPart(new THREE.CylinderGeometry(0.205, 0.205, 0.065, 12), "#bd6b34", [0, 0.04, 0]),
          this.foodPart(new THREE.CylinderGeometry(0.177, 0.177, 0.018, 12), "#edc34e", [0, 0.081, 0]),
          ...toppings.map((position) =>
            this.foodPart(new THREE.SphereGeometry(0.027, 6, 4), "#b63d34", [position[0], position[1], position[2]]),
          ),
        ];
        break;
      }
    }
    this.foodParts.set(item, parts);
    return parts;
  }



  private kitFaceTexture(): THREE.CanvasTexture {
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
    return this.own(texture);
  }

  private ammoFaceTexture(): THREE.CanvasTexture {
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
    return this.own(texture);
  }

  healModel(): PickupModel {
    this.assertActive();
    if (!this.kit) {
      const map = this.kitFaceTexture();
      this.kit = {
        geometry: this.own(new THREE.BoxGeometry(KIT_SIZE.width, KIT_SIZE.height, KIT_SIZE.depth)),
        material: this.own(new THREE.MeshLambertMaterial({
          map,
          emissive: 0xffffff,
          emissiveMap: map,
          emissiveIntensity: KIT_GLOW,
        })),
      };

      this.kit.geometry.translate(0, KIT_SIZE.height / 2, 0);
    }
    return this.kit;
  }

  ammoModel(): PickupModel {
    this.assertActive();
    if (!this.ammo) {
      const map = this.ammoFaceTexture();
      this.ammo = {
        geometry: this.own(new THREE.BoxGeometry(AMMO_SIZE.width, AMMO_SIZE.height, AMMO_SIZE.depth)),
        material: this.own(new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.2 })),
      };
      this.ammo.geometry.translate(0, AMMO_SIZE.height / 2, 0);
    }
    return this.ammo;
  }

  weaponGeometry(weapon: PickupWeaponKind): THREE.PlaneGeometry {
    this.assertActive();
    const cached = this.weaponGeometries.get(weapon);
    if (cached) return cached;
    const size = WEAPON_SPRITE_SIZE[weapon];
    const geometry = this.own(new THREE.PlaneGeometry(size, size));
    bakeIconRectUv(geometry, WEAPON_ICON_RECTS[weapon]);
    this.weaponGeometries.set(weapon, geometry);
    return geometry;
  }

  advanceWeaponClock(realDt: number): void {
    this.assertActive();
    this.clock += realDt;
    this.weaponMaterial.emissiveIntensity =
      WEAPON_GLOW_MIN + (WEAPON_GLOW_MAX - WEAPON_GLOW_MIN) * (0.5 + 0.5 * Math.sin(this.clock * WEAPON_GLOW_SPEED));
  }

}

// Chargement attendu avant la construction des meshes, jamais dans le pas fixe.
export async function loadPickupResources(): Promise<PickupResources> {
  const atlas = await new THREE.TextureLoader().loadAsync(assetUrl(WEAPON_ICON_ATLAS_URL));
  try {
    configureRetroTexture(atlas);
    return new PickupResources(atlas);
  } catch (error) {
    // Si le constructeur a pris possession de l'atlas, il l'a déjà libéré.
    if (atlas.userData.pickupResourcesOwned !== true) atlas.dispose();
    throw error;
  }
}
