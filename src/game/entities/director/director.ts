import type * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

import type { LoyaltyCard } from "../../player/loyaltyCards";
import type { PhysicsWorld } from "../../../physics/world";
import { EnemyEntity } from "../shared/enemyEntity";
import { configureEnemyCharacterController } from "../shared/enemyPhysics";
import type { EnemyState, EnemyUpdateContext } from "../shared/enemyTypes";
import { directorConfig as defaultDirectorConfig, type DirectorConfig } from "./directorConfig";

// see: docs/archive/systems-entites.md#suit-et-director-deux-fines-couches-au-dessus-de-la-machine-partagée

/** Frames de l'animation de mort — même choix que `Suit` (6 frames, 0,9 s au `deathFrameDuration` du Directeur). */
export const DIRECTOR_DEATH_FRAME_COUNT = 6;

export type DirectorState = EnemyState;

export type DirectorUpdateContext = EnemyUpdateContext;

// see: docs/6-reference/notes-code-gameplay-ennemis.md#état-et-horloges
export interface DirectorDamageResult {
  died: boolean;
  justRevealed: boolean;
}

/** Le boss : un ennemi comme les autres, qui tombe le masque sous un seuil de PV. */
export class Director extends EnemyEntity<DirectorConfig> {
  revealed = false;

  constructor(
    physics: PhysicsWorld,
    spawnPosition: THREE.Vector3,
    spawnForward: THREE.Vector3,
    seed: number,
    cfg: DirectorConfig = defaultDirectorConfig,
  ) {
    super(physics, spawnPosition, spawnForward, seed, cfg, DIRECTOR_DEATH_FRAME_COUNT);
  }

  /** Teinte à appliquer sur le sprite (`BillboardSprite.setTint`) pour l'état de révélation courant. */
  get tintColor(): number {
    return this.revealed ? this.cfg.revealedTintColor : this.cfg.humanTintColor;
  }

  // see: docs/6-reference/notes-code-gameplay-ennemis.md#dégâts-et-événements
  override applyDamage(amount: number, physics: PhysicsWorld, knockbackDirection: THREE.Vector3): DirectorDamageResult {
    if (!this.isAlive) return { died: false, justRevealed: false }; // garde-fou, ne devrait jamais arriver.
    const wasRevealed = this.revealed;
    const { died } = super.applyDamage(amount, physics, knockbackDirection);
    if (this.hp <= this.cfg.revealHpFraction * this.cfg.maxHp) this.revealed = true;
    return { died, justRevealed: this.revealed && !wasRevealed };
  }
}

export function configureDirectorCharacterController(
  controller: RAPIER.KinematicCharacterController,
  cfg: DirectorConfig,
) {
  configureEnemyCharacterController(controller, cfg);
}

// see: docs/archive/systems-entites.md#carte-lâchée-par-le-directeur
export class DroppedCard {
  readonly position: THREE.Vector3;
  /** Carte que ce drop donne au ramassage. Le Directeur lâche la Platine ;
   * le champ existe pour que le drop ne préjuge de rien (jalon N7). */
  readonly card: LoyaltyCard;
  collected = false;

  /** Secondes écoulées depuis l'apparition — voir `DirectorConfig.cardPickupDelay`. */
  private age = 0;

  constructor(position: THREE.Vector3, card: LoyaltyCard) {
    this.position = position.clone();
    this.card = card;
  }

  /** Avance l'âge du drop d'un pas fixe — appelé par `DirectorManager.update`, jamais par une horloge murale. */
  tick(dt: number): void {
    this.age += dt;
  }

  tryCollect(playerPosition: THREE.Vector3, pickupRadius: number, minAge: number): boolean {
    if (this.collected) return false;
    if (this.age < minAge) return false;
    if (this.position.distanceToSquared(playerPosition) > pickupRadius * pickupRadius) return false;
    this.collected = true;
    return true;
  }
}
