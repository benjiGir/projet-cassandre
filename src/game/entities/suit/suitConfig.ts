import type { EnemyMeleeConfig } from "../shared/enemyTypes";

/**
 * Espèces d'ennemis qui partagent le gestionnaire et la machine d'état du
 * Costard : un `switch` sur ce champ, pas une hiérarchie (invariant #8).
 */
export type SuitKind = "costard" | "rampant";

// see: docs/6-reference/valeurs-ennemis.md
export interface SuitConfig {
  /** Points de vie max, en PV. */
  maxHp: number;

  // see: docs/6-reference/notes-code-gameplay-ennemis.md#déplacement-et-combat
  capsuleRadius: number;
  capsuleHalfHeight: number;
  /** Hauteur des yeux (origine des raycasts de vision/tir), mesurée depuis les pieds, en mètres. */
  eyeHeight: number;
  characterMass: number;
  colliderOffset: number;
  autostepMaxHeight: number;
  autostepMinWidth: number;
  autostepIncludeDynamicBodies: boolean;
  snapToGroundDistance: number;
  maxSlopeClimbAngleDeg: number;
  minSlopeSlideAngleDeg: number;
  groundStickSpeed: number;
  maxFallSpeed: number;

  /** Distance de détection du joueur, en mètres. Au-delà, IDLE ne vérifie même pas la ligne de vue. */
  sightRange: number;
  // see: docs/6-reference/notes-code-gameplay-ennemis.md#dégâts-et-événements
  lostContactTimeout: number;

  /** Vitesse de poursuite, m/s. Volontairement < vitesse de marche du joueur (9 m/s) : un Costard qui rattrape un joueur immobile mais qu'on peut semer en bougeant. */
  chaseSpeed: number;
  /** Vitesse de rotation du `forward` visuel/de visée, rad/s. Limite le flip instantané de sprite quand l'évitement change de côté. */
  turnRateRadPerSec: number;

  /** Longueur des 3 rayons d'évitement (avant, avant-gauche 30°, avant-droit 30°), en mètres. */
  avoidanceRayLength: number;
  /** Demi-angle des rayons latéraux d'évitement, en degrés. PRESCRIT par le skill (30°). */
  avoidanceSideAngleDeg: number;

  /** Temps passé en ALERTE (pose de « je t'ai vu ») avant de basculer en POURSUITE, en secondes. */
  alertDuration: number;
  attackTelegraphDuration: number;
  /** Temps minimum entre deux attaques, en secondes (indépendant de l'état courant). */
  attackCooldown: number;
  /** Distance max à laquelle une attaque peut être déclenchée, en mètres. */
  attackRange: number;
  /** Durée de l'état RECUL (stagger après avoir encaissé un coup), en secondes. */
  staggerDuration: number;
  /** Durée d'UNE frame de l'animation de mort (4 frames), en secondes. Durée totale = 4 × cette valeur. */
  deathFrameDuration: number;

  /** Dégâts infligés au joueur par attaque réussie. */
  attackDamage: number;
  /** Jitter de visée du raycast d'attaque, en degrés (demi-étendue). PRNG seedé par entité — jamais `Math.random()`. */
  aimJitterDeg: number;
  /** Distance en dessous de laquelle un coup de pompe mortel déclenche des gibs, en mètres — point de tuning ouvert (contrairement aux valeurs de dispersion du pompe, prescrites dans `weaponConfig.ts`). */
  gibDistance: number;

  // see: docs/6-reference/notes-code-gameplay-ennemis.md#état-et-horloges
  /** Vitesse horizontale initiale du recul à l'impact, m/s. */
  knockbackSpeed: number;
  /** Temps de retour à zéro du recul DEPUIS cette vitesse, en secondes (rampe linéaire, même idiome que `approach()` dans `controller.ts`). */
  knockbackDecayTime: number;
  /** Composante verticale initiale du recul (petit « pop » vers le haut), m/s. */
  knockbackUpBoost: number;

  hitFlashDuration: number;

  /** Amplitude du screenshake quand une attaque de Costard touche le joueur, en mètres (via l'API publique existante de `render/fx/fx.ts::triggerShake`). */
  playerHitShakeAmplitude: number;
  /** Durée de ce screenshake, en secondes. */
  playerHitShakeDuration: number;

  /** Attaque au corps-à-corps (Rampant) ; absent = tir à distance. */
  melee?: EnemyMeleeConfig;
}

export const suitConfig: SuitConfig = {
  // 50 : calé pour qu'un tir de pompe totalement à bout portant (9 plombs)
  // tue de façon fiable en un coup — condition nécessaire à la mécanique de
  // gibs. see: docs/archive/reference-valeurs-ennemis.md#vie
  maxHp: 50,

  capsuleRadius: 0.4,
  capsuleHalfHeight: 0.5,
  eyeHeight: 1.6,
  characterMass: 75,
  colliderOffset: 0.01,
  autostepMaxHeight: 0.35,
  autostepMinWidth: 0.2,
  autostepIncludeDynamicBodies: true,
  snapToGroundDistance: 0.4,
  maxSlopeClimbAngleDeg: 50,
  minSlopeSlideAngleDeg: 55,
  groundStickSpeed: 0.2,
  maxFallSpeed: 60,

  sightRange: 22,
  lostContactTimeout: 5,

  chaseSpeed: 3.6,
  turnRateRadPerSec: 8,

  avoidanceRayLength: 1.4,
  avoidanceSideAngleDeg: 30,

  alertDuration: 0.45,
  attackTelegraphDuration: 0.35,
  attackCooldown: 1.7,
  attackRange: 16,
  staggerDuration: 0.4,
  deathFrameDuration: 0.12,

  // 10 à l'origine, baissé après un playtest du niveau v2 : face à plusieurs
  // Costards, le joueur fondait. see: docs/6-reference/valeurs-ennemis.md#combat
  attackDamage: 6,
  aimJitterDeg: 2.5,
  gibDistance: 3,

  knockbackSpeed: 4.5,
  knockbackDecayTime: 0.3,
  knockbackUpBoost: 1.5,

  hitFlashDuration: 0.25,

  playerHitShakeAmplitude: 0.08,
  playerHitShakeDuration: 0.1,
};

// see: docs/archive/reference-valeurs-ennemis.md#variantes-de-knockback-costard-harnais-ab
export interface KnockbackVariant {
  knockbackSpeed: number;
  knockbackDecayTime: number;
  knockbackUpBoost: number;
}

export const KNOCKBACK_VARIANTS: Record<"A" | "B" | "C", KnockbackVariant> = {
  /** Subtil. */
  A: { knockbackSpeed: 2, knockbackDecayTime: 0.25, knockbackUpBoost: 0.6 },
  /** Classique (valeur de départ actuelle, inchangée). */
  B: { knockbackSpeed: 4.5, knockbackDecayTime: 0.3, knockbackUpBoost: 1.5 },
  /** Arcade. */
  C: { knockbackSpeed: 8, knockbackDecayTime: 0.35, knockbackUpBoost: 3 },
};

// see: docs/archive/reference-valeurs-ennemis.md#variantes-de-flash-costard-harnais-ab
export interface FlashVariant {
  hitFlashDuration: number;
}

export const FLASH_VARIANTS: Record<"A" | "B" | "C", FlashVariant> = {
  /** Court. */
  A: { hitFlashDuration: 0.12 },
  /** Classique (valeur de départ actuelle, inchangée). */
  B: { hitFlashDuration: 0.25 },
  /** Long. */
  C: { hitFlashDuration: 0.45 },
};
