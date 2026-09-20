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

// Encodage Rapier : 32 bits = 16 bits d'appartenance (poids fort) + 16 bits
// de filtre (poids faible). Deux colliders a/b interagissent ssi
// ((a >> 16) & b) != 0 && ((b >> 16) & a) != 0 — condition SYMÉTRIQUE :
// mettre ENEMY_SHOT dans le filtre de PLAYER sans l'inverse ne produit
// aucune interaction. La matrice ci-dessous est symétrisée par construction.
// see: docs/systems/physique.md#groupes-de-collision

/** Bits d'appartenance (16 bits utiles). */
export const GROUP = {
  WORLD: 1 << 0,
  PLAYER: 1 << 1,
  ENEMY: 1 << 2,
  PLAYER_SHOT: 1 << 3,
  ENEMY_SHOT: 1 << 4,
  DEBRIS: 1 << 5,
  TRIGGER: 1 << 6,
  PROP: 1 << 7,
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
  GROUP.TRIGGER |
  GROUP.PROP;

/**
 * Masques prêts à poser sur un collider (`ColliderDesc.setCollisionGroups`).
 * Les débris ne collisionnent qu'avec le monde : sinon douilles et gibs
 * bloquent les tirs pour zéro gameplay.
 *
 * see: docs/systems/physique.md#groupes-de-collision
 * see: docs/decisions/0008-collision-ennemi-ennemi.md
 */
export const COLLISION_GROUPS = {
  WORLD: interactionGroups(GROUP.WORLD, ALL_GROUPS),
  PLAYER: interactionGroups(
    GROUP.PLAYER,
    GROUP.WORLD | GROUP.ENEMY | GROUP.ENEMY_SHOT | GROUP.TRIGGER | GROUP.PROP,
  ),
  ENEMY: interactionGroups(
    GROUP.ENEMY,
    GROUP.WORLD | GROUP.PLAYER | GROUP.PLAYER_SHOT | GROUP.ENEMY | GROUP.PROP,
  ),
  PLAYER_SHOT: interactionGroups(GROUP.PLAYER_SHOT, GROUP.WORLD | GROUP.ENEMY | GROUP.PROP),
  ENEMY_SHOT: interactionGroups(GROUP.ENEMY_SHOT, GROUP.WORLD | GROUP.PLAYER),
  DEBRIS: interactionGroups(GROUP.DEBRIS, GROUP.WORLD),
  TRIGGER: interactionGroups(GROUP.TRIGGER, GROUP.PLAYER),
  /**
   * `prop_*` : mobilier poussable/destructible (`game/level/props.ts`).
   *
   * Groupe SÉPARÉ de `WORLD`, et c'est tout l'intérêt. Deux requêtes du jeu
   * filtrent sur `GROUP.WORLD` seul : la ligne de vue des ennemis et le bake
   * du graphe de navigation (`WORLD_ONLY_RAY_GROUPS`, dupliqué dans
   * `entities/enemyMachine.ts` et `level/pathfinding.ts`). Un prop en `WORLD`
   * entrerait donc dans les deux — or il BOUGE, et ces deux résultats sont
   * calculés une fois pour toutes au chargement : un caddie poussé laisserait
   * derrière lui un trou de navigation et un bloqueur de vue fantômes.
   *
   * `ENEMY_SHOT` est volontairement ABSENT du filtre : un prop n'arrête pas
   * une balle ennemie. Sinon un ennemi viderait son chargeur dans une caisse
   * qui ne bloque même pas sa ligne de vue, sans jamais comprendre pourquoi
   * il ne touche plus.
   * see: docs/decisions/0030-props-dynamiques.md
   */
  PROP: interactionGroups(
    GROUP.PROP,
    GROUP.WORLD | GROUP.PLAYER | GROUP.ENEMY | GROUP.PLAYER_SHOT | GROUP.PROP,
  ),
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

  createCharacterController(cfg: MoveConfig = moveConfig): RAPIER.KinematicCharacterController {
    const controller = this.world.createCharacterController(cfg.colliderOffset);
    configureCharacterController(controller, cfg);
    return controller;
  }

  step(dt: number) {
    this.world.timestep = dt;
    this.world.step();
  }

  /** Rapier ne peuple sa broad-phase qu'au `step()` : un pas de durée nulle rend les colliders neufs visibles aux rayons sans rien simuler. */
  // see: docs/systems/physique.md#colliders-invisibles-aux-rayons-avant-le-premier-pas
  refreshSceneQueries() {
    const dt = this.world.timestep;
    this.world.timestep = 0;
    this.world.step();
    this.world.timestep = dt;
  }
}
