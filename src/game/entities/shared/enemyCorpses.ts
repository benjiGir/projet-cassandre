import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

import { GROUP, interactionGroups, type PhysicsWorld } from "../../../physics/world";
import { damageForHit } from "../../player/weapons/weaponConfig";
import type { HitEvent } from "../../player/weapons/weaponTypes";
import { corpseConfig } from "./corpseConfig";
import type { EnemyEntity, EntityConfig } from "./enemyEntity";
import { EventQueue } from "./eventQueue";

export interface CorpseBurstEvent {
  point: THREE.Vector3;
  direction: THREE.Vector3;
}

interface Corpse<TEnemy> {
  enemy: TEnemy | null;
  collider: RAPIER.Collider | null;
  durability: number;
  readonly center: THREE.Vector3;
}

// Les cadavres ne bloquent que les armes ; leur éclatement ne publie jamais de mort.
// see: docs/6-reference/notes-code-gameplay-ennemis.md#cadavres-destructibles
export class EnemyCorpses<TEnemy extends EnemyEntity<EntityConfig>> {
  private readonly slots: Corpse<TEnemy>[];
  private readonly byCollider = new Map<number, Corpse<TEnemy>>();
  private readonly byEnemy = new Map<TEnemy, Corpse<TEnemy>>();
  private readonly burstQueue = new EventQueue<CorpseBurstEvent>();
  private cursor = 0;

  constructor(private readonly physics: PhysicsWorld) {
    this.slots = Array.from({ length: corpseConfig.capacity }, () => ({
      enemy: null,
      collider: null,
      durability: 0,
      center: new THREE.Vector3(),
    }));
  }

  get burstEvents(): readonly CorpseBurstEvent[] {
    return this.burstQueue.all;
  }

  clearFrameEvents(): void {
    this.burstQueue.clear();
  }

  hasCollider(handle: number): boolean {
    return this.byCollider.has(handle);
  }

  register(enemy: TEnemy): void {
    if (this.byEnemy.has(enemy) || !enemy.hasRemains) return;
    const slot = this.slots[this.cursor];
    this.cursor = (this.cursor + 1) % this.slots.length;
    this.retire(slot);
    const feetY = enemy.position.y - enemy.cfg.capsuleHalfHeight - enemy.cfg.capsuleRadius;
    slot.center.set(enemy.position.x, feetY + corpseConfig.halfHeight, enemy.position.z);
    const radius = THREE.MathUtils.clamp(
      enemy.cfg.capsuleRadius * corpseConfig.radiusScale,
      corpseConfig.minRadius,
      corpseConfig.maxRadius,
    );
    slot.collider = this.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(radius, corpseConfig.halfHeight, radius)
        .setTranslation(slot.center.x, slot.center.y, slot.center.z)
        .setCollisionGroups(interactionGroups(GROUP.ENEMY, GROUP.PLAYER_SHOT)),
    );
    slot.enemy = enemy;
    slot.durability = corpseConfig.durability;
    this.byCollider.set(slot.collider.handle, slot);
    this.byEnemy.set(enemy, slot);
  }

  applyHit(hit: HitEvent): boolean {
    const slot = this.byCollider.get(hit.colliderHandle);
    if (!slot) return false;
    slot.durability -= damageForHit(hit);
    if (slot.durability <= 0) this.burst(slot, hit.normal.clone().negate());
    return true;
  }

  applyBlast(
    center: THREE.Vector3,
    damageAt: (distance: number) => number,
    reaches: (point: THREE.Vector3) => boolean,
  ): void {
    for (const slot of this.slots) {
      if (!slot.enemy) continue;
      const damage = damageAt(slot.center.distanceTo(center));
      if (damage <= 0 || !reaches(slot.center)) continue;
      slot.durability -= damage;
      if (slot.durability <= 0) this.burst(slot, slot.center.clone().sub(center).normalize());
    }
  }

  private burst(slot: Corpse<TEnemy>, direction: THREE.Vector3): void {
    direction.y = Math.max(corpseConfig.upwardBias, direction.y);
    direction.normalize();
    const point = slot.center.clone();
    point.y += corpseConfig.burstLift;
    this.burstQueue.push({ point, direction });
    this.retire(slot);
  }

  private retire(slot: Corpse<TEnemy>): void {
    if (slot.enemy) {
      slot.enemy.hasRemains = false;
      this.byEnemy.delete(slot.enemy);
    }
    if (slot.collider) {
      this.byCollider.delete(slot.collider.handle);
      this.physics.world.removeCollider(slot.collider, true);
    }
    slot.enemy = null;
    slot.collider = null;
  }
}
