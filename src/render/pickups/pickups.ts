import * as THREE from "three";

import type { FoodItem } from "../../game/level/interactions/food";
import type { PickupResources } from "./pickupResources";
import type { PickupWeaponKind } from "./pickupTypes";
import { WEAPON_SPRITE_SIZE, WEAPON_BOB_AMPLITUDE, WEAPON_BOB_SPEED } from "./pickupConfig";

// see: docs/6-reference/notes-code-rendu.md#ramassages
export function dressFoodPickup(
  object: THREE.Object3D,
  groundY: number | null,
  item: FoodItem,
  resources: PickupResources,
): void {
  const bounds = new THREE.Box3().setFromObject(object);
  const center = bounds.getCenter(new THREE.Vector3());
  const marker = object as THREE.Mesh;
  if (marker.isMesh) marker.material = resources.hiddenMaterial;

  const model = new THREE.Group();
  model.position.set(center.x, groundY ?? bounds.min.y, center.z);
  for (const part of resources.foodModel(item)) {
    const mesh = new THREE.Mesh(part.geometry, part.material);
    mesh.position.copy(part.position);
    mesh.rotation.copy(part.rotation);
    model.add(mesh);
  }
  object.attach(model);
}

function poser(
  object: THREE.Object3D,
  modele: { geometry: THREE.BufferGeometry; material: THREE.Material },
  groundY: number | null,
  resources: PickupResources,
): void {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());

  const mesh = object as THREE.Mesh;
  if (mesh.isMesh) mesh.material = resources.hiddenMaterial;

  const model = new THREE.Mesh(modele.geometry, modele.material);
  model.position.set(center.x, groundY ?? box.min.y, center.z);

  model.rotation.y = Math.PI / 7;
  object.attach(model);
}

export function dressHealPickup(object: THREE.Object3D, groundY: number | null, resources: PickupResources): void {
  poser(object, resources.healModel(), groundY, resources);
}

export function dressAmmoPickup(object: THREE.Object3D, groundY: number | null, resources: PickupResources): void {
  poser(object, resources.ammoModel(), groundY, resources);
}

export class WeaponPickupBillboard {
  readonly spriteMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;

  // Position LOCALE de repos (sans flottement), capturée après `attachTo` — voir sa doc.
  private baseLocalY = 0;
  // Déphasage du flottement, déterministe (dérivé de la position, PAS du RNG — purement cosmétique, hors invariant #12) : les trois pickups ne flottent pas en phase.
  private readonly bobPhase: number;
  private readonly scratchWorldPos = new THREE.Vector3();

  constructor(
    weapon: PickupWeaponKind,
    worldPosition: THREE.Vector3,
    private readonly resources: PickupResources,
  ) {
    this.spriteMesh = new THREE.Mesh(resources.weaponGeometry(weapon), resources.weaponMaterial);
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
    const bob = Math.sin(this.resources.weaponClock * WEAPON_BOB_SPEED + this.bobPhase) * WEAPON_BOB_AMPLITUDE;
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
  resources: PickupResources,
): WeaponPickupBillboard {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());

  const mesh = object as THREE.Mesh;
  if (mesh.isMesh) mesh.material = resources.hiddenMaterial;

  const billboard = new WeaponPickupBillboard(
    weapon,
    new THREE.Vector3(center.x, groundY ?? box.min.y, center.z),
    resources,
  );
  billboard.attachTo(object);
  return billboard;
}
