import * as THREE from "three";
import type { MeshBasicNodeMaterial } from "three/webgpu";

import { MUZZLE_FLASH_POOL_SIZE, MUZZLE_FLASH_PRESETS, type MuzzleFlashWeapon } from "./muzzleFlashConfig";
import { createMuzzleFlashGeometry } from "./muzzleFlashGeometry";
import { createMuzzleFlashMaterial } from "./muzzleFlashMaterial";
import { drawOverWorld } from "../viewmodel/viewmodelDepth";

interface MuzzleFlashSlot {
  light: THREE.PointLight;
  mesh: THREE.Mesh<THREE.BufferGeometry, MeshBasicNodeMaterial>;
  weapon: MuzzleFlashWeapon;
  age: number;
}

const FORWARD = new THREE.Vector3(0, 0, 1);

// see: docs/6-reference/notes-code-rendu.md#éclairs-de-tir-tsl
export class MuzzleFlashes {
  private readonly slots: MuzzleFlashSlot[] = [];
  private cursor = 0;
  private shotSerial = 0;
  private readonly scratchDirection = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const geometry = createMuzzleFlashGeometry();
    const material = createMuzzleFlashMaterial();
    for (let i = 0; i < MUZZLE_FLASH_POOL_SIZE; i++) {
      // Garder le nombre de lampes constant évite de recompiler Lambert au tir.
      const light = new THREE.PointLight(0xffe5a0, 0, 4, 2);
      scene.add(light);
      const mesh = drawOverWorld(new THREE.Mesh(geometry, material));
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 1;
      scene.add(mesh);
      this.slots.push({ light, mesh, weapon: "pistol", age: -1 });
    }
  }

  spawnMuzzleFlash(position: THREE.Vector3, direction: THREE.Vector3, weapon: MuzzleFlashWeapon): void {
    const slot = this.slots[this.cursor]!;
    this.cursor = (this.cursor + 1) % this.slots.length;
    const preset = MUZZLE_FLASH_PRESETS[weapon];
    const serial = this.shotSerial++;
    const variation = 0.94 + (serial * 5 % 7) * 0.02;
    slot.weapon = weapon;
    slot.age = 0;
    slot.mesh.userData.flashAge = 0;
    slot.mesh.userData.flashSeed = (serial * 2.399963) % (Math.PI * 2);
    slot.mesh.userData.flashSpread = weapon === "shotgun" ? 1 : 0;
    slot.mesh.userData.flashRoll = (serial * 1.113) % (Math.PI * 2);
    slot.mesh.scale.set(preset.width * variation, preset.width * variation, preset.length * variation);
    slot.mesh.visible = true;
    slot.light.color.setHex(preset.color);
    slot.light.distance = preset.range;
    slot.light.intensity = preset.intensity;
    this.pose(slot, position, direction);
  }

  followMuzzle(position: THREE.Vector3, direction: THREE.Vector3, weapon: MuzzleFlashWeapon): void {
    for (const slot of this.slots) {
      if (slot.age >= 0 && slot.weapon === weapon) this.pose(slot, position, direction);
    }
  }

  advance(dt: number): void {
    for (const slot of this.slots) {
      if (slot.age < 0) continue;
      slot.age += dt;
      const preset = MUZZLE_FLASH_PRESETS[slot.weapon];
      if (slot.age >= preset.duration) {
        this.release(slot);
        continue;
      }
      const age = slot.age / preset.duration;
      slot.mesh.userData.flashAge = age;
      slot.light.intensity = preset.intensity * (1 - age) * (1 - age);
    }
  }

  reset(): void {
    for (const slot of this.slots) this.release(slot);
    this.cursor = 0;
    this.shotSerial = 0;
  }

  async warm(camera: THREE.Camera, render: () => void): Promise<void> {
    this.reset();
    const slot = this.slots[0]!;
    const position = new THREE.Vector3();
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    camera.getWorldPosition(position).addScaledVector(direction, 0.6);
    this.spawnMuzzleFlash(position, direction, "shotgun");
    slot.light.intensity = 0;
    try {
      render();
      await Promise.resolve();
      render();
    } finally {
      this.reset();
    }
  }

  private pose(slot: MuzzleFlashSlot, position: THREE.Vector3, direction: THREE.Vector3): void {
    this.scratchDirection.copy(direction).normalize();
    slot.mesh.position.copy(position).addScaledVector(this.scratchDirection, MUZZLE_FLASH_PRESETS[slot.weapon].offset);
    slot.mesh.quaternion.setFromUnitVectors(FORWARD, this.scratchDirection);
    slot.mesh.rotateZ(slot.mesh.userData.flashRoll as number);
    slot.light.position.copy(slot.mesh.position);
  }

  private release(slot: MuzzleFlashSlot): void {
    slot.age = -1;
    slot.mesh.visible = false;
    slot.light.intensity = 0;
  }
}
