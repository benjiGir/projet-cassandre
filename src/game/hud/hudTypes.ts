import type { WeaponKind } from "../player/weapons/weaponTypes";
import type { LoyaltyCard } from "../player/loyaltyCards";

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

/** Une ligne du chat du direct. */
export interface ChatMessage {
  /** Rang d'émission dans la partie : clé stable pour l'affichage. */
  readonly id: number;
  readonly pseudo: string;
  readonly text: string;
  /** `don` : la ligne annonce un don, `message` : un spectateur écrit. */
  readonly kind: "message" | "don";
}

/** Un don qui vient d'arriver, affiché en alerte. */
export interface DonationAlert {
  readonly pseudo: string;
  /** Euros. */
  readonly amount: number;
  readonly text: string;
  /** Le don vient du donateur mystère de l'histoire. */
  readonly mystery: boolean;
}

/** Ce que vend la borne à portée du joueur, pour l'invite d'interaction. */
export interface PerkOfferView {
  /** Touche d'usage, telle que le joueur l'a réglée. */
  readonly key: string;
  readonly label: string;
  /** Ce que le perk change, en quelques mots. */
  readonly effect: string;
  /** Euros. */
  readonly price: number;
  /** Déjà acheté dans cette partie : la borne est épuisée. */
  readonly sold: boolean;
}

/** Message diffusé dans le magasin : haut-parleurs ou interphone. */
export interface StoreAnnouncement {
  readonly speaker: string;
  readonly text: string;
}

/** Un panneau illustré d'intro ou de fin. */
export interface StoryPanel {
  readonly id: string;
  /** Chemin sous `public/`, ou `null` tant que l'image n'est pas livrée. */
  readonly image: string | null;
  /** Description de l'image pour un lecteur d'écran. */
  readonly alt: string;
  /** Légende, une ligne par entrée — posée par le jeu, jamais dessinée dans l'image. */
  readonly caption: readonly string[];
}

/** Bilan du direct en fin de partie. Informatif : il ne compte pas dans le score. */
export interface LiveRecap {
  readonly peakViewers: number;
  readonly followers: number;
  readonly followersGained: number;
  /** Euros reçus cette partie. */
  readonly donations: number;
  readonly donationCount: number;
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
  /** Abonnés de la chaîne, gagnés avec l'audience. */
  followers: number;
  /** Dons reçus cette partie, en euros. */
  wallet: number;
}
