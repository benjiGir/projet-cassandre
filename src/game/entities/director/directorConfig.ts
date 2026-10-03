// see: docs/6-reference/valeurs-ennemis.md

import { type LoyaltyCard } from "../../player/loyaltyCards";
export interface DirectorConfig {
  /** Points de vie max. */
  maxHp: number;
  // see: docs/6-reference/notes-code-gameplay-ennemis.md#état-et-horloges
  revealHpFraction: number;

  // Mêmes conventions que `SuitConfig` (elle-même calquée sur `MoveConfig`),
  // dupliquées ici pour la même raison qu'elle — voir sa doc de tête.
  capsuleRadius: number;
  capsuleHalfHeight: number;
  /** Hauteur des yeux depuis les pieds, en mètres. */
  eyeHeight: number;
  characterMass: number;
  colliderOffset: number;
  autostepMaxHeight: number;
  autostepMinWidth: number;
  autostepIncludeDynamicBodies: boolean;
  snapToGroundDistance: number;
  maxSlopeClimbAngleDeg: number;
  minSlopeSlideAngleDeg: number;
  /** Même valeur et même raison que `SuitConfig.groundStickSpeed` — voir sa doc détaillée dans `suitConfig.ts`/`moveConfig.ts`. */
  groundStickSpeed: number;
  maxFallSpeed: number;

  /** Distance de détection du joueur, en mètres. */
  sightRange: number;
  /** Temps sans contact visuel avant de retomber en IDLE, en secondes. Même valeur PRESCRITE par le skill `enemy-state-machine` que pour le Costard. */
  lostContactTimeout: number;

  /** Vitesse de poursuite, m/s. */
  chaseSpeed: number;
  /** Vitesse de rotation du `forward` visuel/de visée, rad/s. */
  turnRateRadPerSec: number;

  /** Longueur des 3 rayons d'évitement, en mètres. */
  avoidanceRayLength: number;
  /** Demi-angle des rayons latéraux d'évitement, en degrés. PRESCRIT par le skill (30°), identique au Costard. */
  avoidanceSideAngleDeg: number;

  /** Temps passé en ALERTE avant de basculer en POURSUITE, en secondes. */
  alertDuration: number;
  // see: docs/6-reference/notes-code-gameplay-ennemis.md#dégâts-et-événements
  attackTelegraphDuration: number;
  /** Temps minimum entre deux attaques, en secondes. */
  attackCooldown: number;
  /** Distance max à laquelle une attaque peut être déclenchée, en mètres. */
  attackRange: number;
  /** Durée de l'état RECUL (stagger après avoir encaissé un coup), en secondes. */
  staggerDuration: number;
  /** Durée d'UNE frame de l'animation de mort, en secondes. Durée totale = `deathFrameCount` × cette valeur (voir `DIRECTOR_DEATH_FRAME_COUNT` dans `director.ts`). */
  deathFrameDuration: number;

  /** Dégâts infligés au joueur par attaque réussie. */
  attackDamage: number;
  /** Jitter de visée du raycast d'attaque, en degrés (demi-étendue). PRNG seedé par entité — jamais `Math.random()`. */
  aimJitterDeg: number;

  // Le Directeur est un corps KINÉMATIQUE, exactement comme le Costard :
  // `RAPIER.RigidBody.applyImpulse` n'a AUCUN EFFET dessus. Voir
  // `Director.applyDamage`/`Director.updateKnockback`.
  /** Vitesse horizontale initiale du recul à l'impact, m/s. */
  knockbackSpeed: number;
  /** Temps de retour à zéro du recul, en secondes. */
  knockbackDecayTime: number;
  /** Composante verticale initiale du recul, m/s. */
  knockbackUpBoost: number;

  /** Durée du flash blanc de dégât sur le sprite touché, en secondes — même mécanisme et même valeur de départ que `SuitConfig.hitFlashDuration`. */
  hitFlashDuration: number;

  /** Teinte (`material.color`, voir `BillboardSprite.setTint`) tant que le Directeur porte encore son costume humain — blanc = atlas affiché sans teinte, identique au rendu du Costard. */
  humanTintColor: number;
  /** Teinte appliquée dès la révélation (`Director.revealed === true`) — PLACEHOLDER explicite (pas d'art final). */
  revealedTintColor: number;
  /** Amplitude du screenshake au moment de la révélation, en mètres (via `fx.triggerShake`, API publique existante). */
  revealShakeAmplitude: number;
  /** Durée de ce screenshake, en secondes. */
  revealShakeDuration: number;

  cardPickupRadius: number;
  cardPickupDelay: number;

  /** Amplitude du screenshake quand une attaque du Directeur touche le joueur, en mètres — plus haute que `SuitConfig.playerHitShakeAmplitude` : un coup de boss doit se sentir plus lourd qu'un coup de Costard. */
  playerHitShakeAmplitude: number;
  /** Durée de ce screenshake, en secondes. */
  playerHitShakeDuration: number;
}

export const directorConfig: DirectorConfig = {
  maxHp: 300,
  revealHpFraction: 0.5,

  capsuleRadius: 0.45,
  capsuleHalfHeight: 0.6,
  eyeHeight: 1.8,
  characterMass: 110,
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

  chaseSpeed: 3.2,
  turnRateRadPerSec: 6,

  avoidanceRayLength: 1.6,
  avoidanceSideAngleDeg: 30,

  alertDuration: 0.45,
  attackTelegraphDuration: 0.4,
  attackCooldown: 2.2,
  attackRange: 14,
  staggerDuration: 0.45,
  deathFrameDuration: 0.15,

  // 15 à l'origine, baissé en même temps que le Costard (6) pour garder l'écart.
  attackDamage: 10,
  aimJitterDeg: 2,

  knockbackSpeed: 3,
  knockbackDecayTime: 0.3,
  knockbackUpBoost: 1,

  hitFlashDuration: 0.25,

  humanTintColor: 0xffffff,
  revealedTintColor: 0x33cc55,
  revealShakeAmplitude: 0.12,
  revealShakeDuration: 0.25,

  cardPickupRadius: 1.5,
  cardPickupDelay: 0.6,

  playerHitShakeAmplitude: 0.1,
  playerHitShakeDuration: 0.12,
};

// see: docs/archive/reference-conventions-nommage.md#cartes-de-fidélité
export const DIRECTOR_DROPPED_CARD: LoyaltyCard = "platine";
