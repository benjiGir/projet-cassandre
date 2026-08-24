import RAPIER from "@dimforge/rapier3d-compat";

import { moveConfig, type MoveConfig } from "../game/player/moveConfig";

let initialized = false;

/** Charge le module WASM. À appeler une fois, avant de créer un PhysicsWorld. */
export async function initPhysics(): Promise<typeof RAPIER> {
  if (!initialized) {
    await RAPIER.init();
    initialized = true;
  }
  return RAPIER;
}

// ---------------------------------------------------------------------------
// Groupes de collision
//
// Rapier encode l'interaction sur 32 bits : 16 bits d'appartenance (poids
// fort) et 16 bits de filtre (poids faible). Deux colliders a et b
// interagissent si et seulement si :
//
//     ((a >> 16) & b) != 0  &&  ((b >> 16) & a) != 0
//
// La condition est SYMÉTRIQUE : déclarer « ENEMY_SHOT touche PLAYER » sans
// mettre ENEMY_SHOT dans le filtre de PLAYER ne produit aucune interaction.
// La matrice ci-dessous est donc symétrisée par construction.
// ---------------------------------------------------------------------------

/** Bits d'appartenance (16 bits utiles). */
export const GROUP = {
  WORLD: 1 << 0,
  PLAYER: 1 << 1,
  ENEMY: 1 << 2,
  PLAYER_SHOT: 1 << 3,
  ENEMY_SHOT: 1 << 4,
  DEBRIS: 1 << 5,
  TRIGGER: 1 << 6,
} as const;

/** Compose un masque d'interaction Rapier à partir des bits d'appartenance et de filtre. */
export function interactionGroups(memberships: number, filter: number): number {
  return (((memberships & 0xffff) << 16) | (filter & 0xffff)) >>> 0;
}

const ALL_GROUPS =
  GROUP.WORLD |
  GROUP.PLAYER |
  GROUP.ENEMY |
  GROUP.PLAYER_SHOT |
  GROUP.ENEMY_SHOT |
  GROUP.DEBRIS |
  GROUP.TRIGGER;

/**
 * Masques prêts à poser sur un collider (`ColliderDesc.setCollisionGroups`).
 *
 * | Groupe        | Interagit avec                          |
 * |---------------|-----------------------------------------|
 * | WORLD         | tout                                    |
 * | PLAYER        | WORLD, ENEMY, ENEMY_SHOT, TRIGGER       |
 * | ENEMY         | WORLD, PLAYER, PLAYER_SHOT, ENEMY       |
 * | PLAYER_SHOT   | WORLD, ENEMY                            |
 * | ENEMY_SHOT    | WORLD, PLAYER                           |
 * | DEBRIS        | WORLD uniquement                        |
 * | TRIGGER       | PLAYER uniquement (sensor)              |
 *
 * Les débris ne collisionnent qu'avec le monde : sinon douilles et gibs
 * bloquent les tirs pour zéro gameplay.
 *
 * ENEMY s'inclut lui-même depuis 2026-08-23 (voir [[project_cassandre_boomer_shooter]]
 * mémoire pour la trouvaille) : sans ça, deux ennemis (Costard-Costard ou
 * Costard-Directeur) peuvent s'interpénétrer entièrement en convergeant sur
 * le même point (les 3 rayons d'évitement de `computeAvoidedDirection` ne
 * testent QUE `WORLD`, jamais les autres ennemis) — invisible en combat épars,
 * mais produit un z-fighting franc (billboards presque coplanaires, quasi la
 * même distance caméra) une fois plusieurs ennemis massés au même endroit
 * (typiquement autour du joueur mort). Le `KinematicCharacterController`
 * partagé de `SuitManager`/`DirectorManager` gère déjà la réponse de
 * collision pour n'importe quel handle autre que soi-même
 * (`(other) => other.handle !== collider.handle` dans `suit.ts`/`director.ts`)
 * — élargir ce masque suffit, aucun autre code à toucher.
 *
 * Seuls WORLD et PLAYER sont utilisés en Phase 1 ; les autres sont déclarés
 * pour les phases suivantes.
 */
export const COLLISION_GROUPS = {
  WORLD: interactionGroups(GROUP.WORLD, ALL_GROUPS),
  PLAYER: interactionGroups(
    GROUP.PLAYER,
    GROUP.WORLD | GROUP.ENEMY | GROUP.ENEMY_SHOT | GROUP.TRIGGER,
  ),
  ENEMY: interactionGroups(GROUP.ENEMY, GROUP.WORLD | GROUP.PLAYER | GROUP.PLAYER_SHOT | GROUP.ENEMY),
  PLAYER_SHOT: interactionGroups(GROUP.PLAYER_SHOT, GROUP.WORLD | GROUP.ENEMY),
  ENEMY_SHOT: interactionGroups(GROUP.ENEMY_SHOT, GROUP.WORLD | GROUP.PLAYER),
  DEBRIS: interactionGroups(GROUP.DEBRIS, GROUP.WORLD),
  TRIGGER: interactionGroups(GROUP.TRIGGER, GROUP.PLAYER),
} as const;

/**
 * Applique la configuration de déplacement à un KinematicCharacterController.
 * Séparé de la fabrique pour pouvoir être rejoué à chaud après une
 * modification de `moveConfig` (A/B de `feel-tuner`).
 */
export function configureCharacterController(
  controller: RAPIER.KinematicCharacterController,
  cfg: MoveConfig = moveConfig,
) {
  controller.setUp({ x: 0, y: 1, z: 0 });
  controller.setOffset(cfg.colliderOffset);
  controller.setSlideEnabled(true);
  controller.enableAutostep(
    cfg.autostepMaxHeight,
    cfg.autostepMinWidth,
    cfg.autostepIncludeDynamicBodies,
  );
  controller.enableSnapToGround(cfg.snapToGroundDistance);
  controller.setMaxSlopeClimbAngle((cfg.maxSlopeClimbAngleDeg * Math.PI) / 180);
  controller.setMinSlopeSlideAngle((cfg.minSlopeSlideAngleDeg * Math.PI) / 180);
  controller.setApplyImpulsesToDynamicBodies(true);
  controller.setCharacterMass(cfg.characterMass);
}

export class PhysicsWorld {
  readonly world: RAPIER.World;

  constructor(gravity: RAPIER.Vector3 = { x: 0, y: -25, z: 0 }) {
    this.world = new RAPIER.World(gravity);
  }

  /**
   * Gravité verticale du monde, m/s². Source unique : tout code qui intègre
   * lui-même une vitesse verticale (le character controller kinématique) doit
   * la lire ici, jamais la redéclarer.
   */
  get gravityY(): number {
    return this.world.gravity.y;
  }

  /** Fabrique un KinematicCharacterController configuré selon `moveConfig`. */
  createCharacterController(cfg: MoveConfig = moveConfig): RAPIER.KinematicCharacterController {
    const controller = this.world.createCharacterController(cfg.colliderOffset);
    configureCharacterController(controller, cfg);
    return controller;
  }

  step(dt: number) {
    this.world.timestep = dt;
    this.world.step();
  }
}
