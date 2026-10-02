import type { WeaponKind } from "./player/weaponTypes";
import type { LoyaltyCard } from "./player/loyaltyCards";

// see: docs/decisions/0036-contrats-feuilles-et-store-hud.md

export type HeroPortraitReaction = "idle" | "hurt" | "focus" | "victory" | "discover" | "talk" | "heal" | "dead";

export interface HeroPortraitView {
  readonly sheet: "reactions" | "ambient";
  readonly frame: number;
  readonly reaction: HeroPortraitReaction;
  readonly healthBand: number;
  readonly side: "left" | "front" | "right";
  readonly impact: number;
  readonly combo: boolean;
}

export interface RecapLine {
  label: string;
  detail: string;
  points: number;
}

export interface LevelRecap {
  lines: RecapLine[];
  total: number;
  elapsedSeconds: number;
  parTimeSeconds: number | null;
  accuracy: number;
}

export interface DebugState {
  fps: number;
  /** Position des yeux du joueur, m. */
  position: { x: number; y: number; z: number };
  entityCount: number;
  /** Pas fixes exécutés pendant la dernière frame d'affichage (spirale de rattrapage si > 2 durablement). */
  steps: number;

  // see: docs/archive/systems-boucle-de-jeu.md#mesure-des-temps-de-frame-loopstats
  gameplayMs: number;
  gameplayP95Ms: number;
  astarQueries: number;
  astarMisses: number;
  astarExpandedNodes: number;
  astarLastMs: number;
  astarMaxMs: number;
  physicsMs: number;
  renderMs: number;

  // see: docs/archive/systems-debug.md#coût-de-rendu
  /** Draw calls de la dernière image rendue (`renderer.info.render.calls`). */
  drawCalls: number;
  /** Triangles de la dernière image rendue (`renderer.info.render.triangles`). */
  triangles: number;

  // see: docs/archive/systems-debug.md#champs-de-debugstate
  isGrounded: boolean;
  /** Vitesse horizontale, m/s. */
  horizontalSpeed: number;
  /** Vitesse verticale, m/s. */
  verticalSpeed: number;
  /** Collisions du dernier `computeColliderMovement`. */
  numCollisions: number;
  /** Normale du sol sous les pieds. */
  groundNormal: { x: number; y: number; z: number };

  playerHp: number;
  playerMaxHp: number;

  shotgunAmmo: number;
  shotgunMaxAmmo: number;
  pistolAmmo: number;
  pistolMaxAmmo: number;

  activeWeapon: WeaponKind;

  secretsFound: number;
  secretsTotal: number;

  cards: readonly LoyaltyCard[];

  views: number;
}
