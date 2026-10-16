import * as THREE from "three";
import { GRAVITY_Y } from "../../../physics/constants";
import { FLOOR_NORMAL_Y, type SurfaceProbe } from "../goreConfig";
import { createFragmentGeometry, createFragmentMaterial } from "./fragmentGeometry";
import { FRAGMENT_RECIPES } from "./fragmentRecipes";
import { propDebrisConfig } from "./propDebrisConfig";
import type { FragmentMaterial, FragmentPose } from "./propDebrisTypes";

interface Fragment {
  active: boolean;
  flying: boolean;
  age: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Quaternion;
  scale: THREE.Vector3;
  spin: THREE.Vector3;
}

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

// Réserve de débris cosmétiques ; seuls les morceaux en vol interrogent le décor.
export class FragmentBatch {
  readonly mesh: THREE.InstancedMesh;
  private readonly slots: Fragment[];
  private cursor = 0;
  private activeCount = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly direction = new THREE.Vector3();
  private readonly support = new THREE.Vector3();
  private readonly inverse = new THREE.Quaternion();
  private readonly spinRotation = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();
  private readonly facing = new THREE.Quaternion();

  constructor(
    private readonly kind: FragmentMaterial,
    private readonly random: () => number,
  ) {
    const capacity = propDebrisConfig.capacityPerMaterial;
    this.mesh = new THREE.InstancedMesh(createFragmentGeometry(kind), createFragmentMaterial(kind), capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.slots = Array.from({ length: capacity }, () => ({
      active: false,
      flying: false,
      age: 0,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
      spin: new THREE.Vector3(),
    }));
    for (let i = 0; i < capacity; i++) {
      this.mesh.setMatrixAt(i, HIDDEN);
      this.mesh.setColorAt(i, new THREE.Color());
    }
    this.mesh.visible = false;
  }

  spawn(pose: FragmentPose): void {
    const index = this.cursor;
    this.cursor = (this.cursor + 1) % this.slots.length;
    const slot = this.slots[index];
    if (!slot.active) this.activeCount++;
    slot.active = slot.flying = true;
    slot.age = 0;
    slot.position.copy(pose.position);
    slot.velocity.copy(pose.velocity);
    slot.rotation.copy(pose.rotation);
    slot.scale.copy(pose.scale);
    slot.spin.set((this.random() - 0.5) * 10, (this.random() - 0.5) * 8, (this.random() - 0.5) * 10);
    this.mesh.setColorAt(index, pose.color);
    this.mesh.instanceColor!.needsUpdate = true;
    this.write(index);
    this.mesh.visible = true;
  }

  update(dt: number, probe: SurfaceProbe | null): void {
    if (this.activeCount === 0) return;
    let remaining = Math.min(dt, 0.1);
    while (remaining > 1e-6) {
      const step = Math.min(remaining, 1 / 60);
      this.step(step, probe);
      remaining -= step;
    }
  }

  private step(dt: number, probe: SurfaceProbe | null): void {
    const recipe = FRAGMENT_RECIPES[this.kind];
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot.active || !slot.flying) continue;
      slot.age += dt;
      if (slot.age > (recipe.lifetime || propDebrisConfig.maxFlight)) {
        slot.active = false;
        this.activeCount--;
        this.write(i);
        continue;
      }
      slot.velocity.y += GRAVITY_Y * recipe.gravity * dt;
      slot.velocity.multiplyScalar(Math.exp(-recipe.drag * dt));
      if (recipe.lifetime) {
        const growth = this.kind === "flour" ? (slot.age < recipe.lifetime * 0.55 ? 0.9 : -8) : -1.5;
        slot.scale.multiplyScalar(Math.exp(growth * dt));
      }
      const distance = slot.velocity.length() * dt;
      this.direction.copy(slot.velocity).normalize();
      const radius = this.supportRadius(slot, this.direction);
      const hit = probe && distance > 1e-6 ? probe(slot.position, this.direction, distance + radius) : null;
      if (hit) {
        if (recipe.lifetime) {
          slot.active = false;
          this.activeCount--;
        } else if (hit.normal.y > FLOOR_NORMAL_Y) {
          slot.flying = false;
          this.facing.setFromUnitVectors(UP, hit.normal);
          this.spinRotation.setFromAxisAngle(UP, this.random() * Math.PI * 2);
          slot.rotation.copy(this.facing).multiply(this.spinRotation);
        } else slot.velocity.reflect(hit.normal).multiplyScalar(propDebrisConfig.wallRestitution);
        slot.position
          .copy(hit.point)
          .addScaledVector(hit.normal, this.supportRadius(slot, hit.normal) + propDebrisConfig.surfaceOffset);
      } else {
        slot.position.addScaledVector(slot.velocity, dt);
        this.euler.set(slot.spin.x * dt, slot.spin.y * dt, slot.spin.z * dt);
        this.spinRotation.setFromEuler(this.euler);
        slot.rotation.multiply(this.spinRotation).normalize();
      }
      this.write(i);
    }
    this.mesh.visible = this.activeCount > 0;
  }

  private supportRadius(slot: Fragment, normal: THREE.Vector3): number {
    this.inverse.copy(slot.rotation).invert();
    this.support.copy(normal).applyQuaternion(this.inverse);
    return (
      (Math.abs(this.support.x) * slot.scale.x +
        Math.abs(this.support.y) * slot.scale.y +
        Math.abs(this.support.z) * slot.scale.z) *
      0.5
    );
  }

  private write(index: number): void {
    const slot = this.slots[index];
    this.mesh.setMatrixAt(index, slot.active ? this.matrix.compose(slot.position, slot.rotation, slot.scale) : HIDDEN);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  reset(): void {
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i].active = false;
      this.mesh.setMatrixAt(i, HIDDEN);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = false;
    this.cursor = 0;
    this.activeCount = 0;
  }
}
