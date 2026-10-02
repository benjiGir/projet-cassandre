import * as THREE from "three";

import { assetUrl } from "../core/assetPath";
import { LOYALTY_CARDS, type LoyaltyCard } from "../game/player/loyaltyCards";
import { configureRetroTexture } from "./renderer";

export type CardPickupTextures = Readonly<Record<LoyaltyCard, THREE.Texture>>;

const CARD_WIDTH = 0.7;
const CARD_HEIGHT = CARD_WIDTH * 80 / 128;
const CARD_FLOAT_HEIGHT = 0.22;
const CARD_BOB_AMPLITUDE = 0.06;
const UP = new THREE.Vector3(0, 1, 0);

export async function loadCardPickupTextures(): Promise<CardPickupTextures> {
  const textures = await Promise.all(LOYALTY_CARDS.map(async (card) => {
    const texture = await new THREE.TextureLoader().loadAsync(assetUrl(`assets/sprites/cards/${card}.png`));
    configureRetroTexture(texture);
    return [card, texture] as const;
  }));
  return Object.fromEntries(textures) as Record<LoyaltyCard, THREE.Texture>;
}

export class CardPickupBillboard {
  readonly spriteMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;

  private baseLocalY: number;
  private clock = 0;
  private readonly phase: number;
  private readonly worldPosition = new THREE.Vector3();
  private readonly cameraPosition = new THREE.Vector3();
  private readonly parentRotation = new THREE.Quaternion();
  private readonly worldRotation = new THREE.Quaternion();

  constructor(card: LoyaltyCard, position: THREE.Vector3, textures: CardPickupTextures) {
    // Cloner isole la libération du niveau et du drop pendant un hot reload.
    const texture = textures[card].clone();
    configureRetroTexture(texture);
    const material = new THREE.MeshLambertMaterial({
      map: texture,
      emissiveMap: texture,
      emissive: 0xffffff,
      emissiveIntensity: 0.75,
      alphaTest: 0.5,
      transparent: false,
      depthWrite: true,
    });
    this.spriteMesh = new THREE.Mesh(new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT), material);
    this.spriteMesh.name = `pickup_carte_${card}`;
    this.spriteMesh.position.set(position.x, position.y + CARD_FLOAT_HEIGHT + CARD_HEIGHT / 2, position.z);
    this.baseLocalY = this.spriteMesh.position.y;
    this.phase = (position.x * 12.9898 + position.z * 78.233) % (2 * Math.PI);
  }

  attachTo(parent: THREE.Object3D): void {
    parent.attach(this.spriteMesh);
    this.baseLocalY = this.spriteMesh.position.y;
  }

  // Flottement et orientation cosmétiques, au taux d'affichage uniquement.
  update(camera: THREE.Camera, realDt: number): void {
    this.clock += realDt;
    this.spriteMesh.position.y = this.baseLocalY + Math.sin(this.clock * 2.1 + this.phase) * CARD_BOB_AMPLITUDE;
    this.spriteMesh.material.emissiveIntensity = 0.65 + 0.2 * (0.5 + 0.5 * Math.sin(this.clock * 1.4 + this.phase));
    this.spriteMesh.getWorldPosition(this.worldPosition);
    camera.getWorldPosition(this.cameraPosition);
    const yaw = Math.atan2(this.cameraPosition.x - this.worldPosition.x, this.cameraPosition.z - this.worldPosition.z);
    this.worldRotation.setFromAxisAngle(UP, yaw);
    if (this.spriteMesh.parent) {
      this.spriteMesh.parent.getWorldQuaternion(this.parentRotation);
      this.spriteMesh.quaternion.copy(this.parentRotation.invert()).multiply(this.worldRotation);
    } else {
      this.spriteMesh.quaternion.copy(this.worldRotation);
    }
  }

  dispose(): void {
    this.spriteMesh.removeFromParent();
    this.spriteMesh.geometry.dispose();
    this.spriteMesh.material.map?.dispose();
    this.spriteMesh.material.dispose();
  }
}

export function dressCardPickup(
  object: THREE.Object3D,
  card: LoyaltyCard,
  groundY: number | null,
  textures: CardPickupTextures,
): CardPickupBillboard {
  const bounds = new THREE.Box3().setFromObject(object);
  const center = bounds.getCenter(new THREE.Vector3());
  // Garder le parent actif pour l’interaction et l’élagage.
  if (object instanceof THREE.Mesh) {
    object.material = new THREE.MeshLambertMaterial({ visible: false });
  }
  const billboard = new CardPickupBillboard(card, new THREE.Vector3(center.x, groundY ?? bounds.min.y, center.z), textures);
  billboard.attachTo(object);
  return billboard;
}
