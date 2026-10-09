// see: docs/6-reference/notes-code-gameplay-joueur.md#déplacement-et-vue
export interface MoveConfig {
  /** Vitesse horizontale max en marche, m/s. */
  walkSpeed: number;
  /** Vitesse horizontale max en course (ShiftLeft), m/s. */
  runSpeed: number;
  timeToMaxSpeed: number;
  timeToStop: number;
  airControl: number;

  /** Hauteur de saut visée, en mètres. v₀ est dérivée de cette hauteur et de la gravité du monde. */
  jumpHeight: number;
  coyoteTime: number;
  jumpBufferTime: number;
  // see: docs/archive/systems-joueur.md#une-vitesse-de-collage-au-sol-volontairement-faible-groundstickspeed
  groundStickSpeed: number;
  /** Vitesse de chute maximale, m/s. Garde-fou anti-tunneling après une longue chute. */
  maxFallSpeed: number;

  /** Rayon de la capsule du joueur, en mètres. */
  capsuleRadius: number;
  /** Demi-hauteur du segment de la capsule, en mètres. Hauteur totale = 2 × (halfHeight + radius). */
  capsuleHalfHeight: number;
  /** Hauteur des yeux mesurée depuis les pieds, en mètres. */
  eyeHeight: number;
  /** Masse du personnage, en kg. Utilisée pour les impulsions transmises aux corps dynamiques. */
  characterMass: number;

  /** Marge conservée entre la capsule et le décor, en mètres. Jamais 0 (stabilité numérique). */
  colliderOffset: number;
  /** Hauteur de marche franchissable automatiquement, en mètres. */
  autostepMaxHeight: number;
  /** Largeur libre minimale requise après une marche, en mètres. */
  autostepMinWidth: number;
  /** Autoriser l'autostep sur les corps dynamiques. */
  autostepIncludeDynamicBodies: boolean;
  /** Distance de recollage au sol en descente, en mètres. */
  snapToGroundDistance: number;
  /** Pente maximale gravissable, en degrés. */
  maxSlopeClimbAngleDeg: number;
  /** Pente à partir de laquelle le joueur glisse tout seul, en degrés. */
  minSlopeSlideAngleDeg: number;

  /** Sensibilité souris, en radians par pixel de `movementX`. */
  lookSensitivity: number;
  /** Limite de pitch (haut/bas), en degrés. */
  pitchLimitDeg: number;

  // Vue : head bob — positionnel uniquement, jamais angulaire (invariant #3) :
  // see: docs/archive/systems-joueur.md#vue-head-bob-fov-dynamique-réception-de-saut

  bobDistancePerCycle: number;
  /** Amplitude verticale du bob à pleine intensité, en mètres (crête). */
  bobVerticalAmplitude: number;
  /** Amplitude latérale du balancement à pleine intensité, en mètres (crête). */
  bobLateralAmplitude: number;
  bobSpeedFloor: number;
  bobResponseTime: number;

  /** FOV vertical au repos, en degrés. Utilisé à la construction de la caméra. */
  fovBase: number;
  /** Élargissement maximal du FOV à pleine vitesse, en degrés (ajouté à `fovBase`). */
  fovRunBoost: number;
  fovBoostStartFraction: number;
  /** Fraction de `runSpeed` à laquelle l'élargissement est MAXIMAL. */
  fovBoostFullFraction: number;
  fovResponseTime: number;

  /** Enfoncement vertical maximal de la vue à la réception, en mètres. 0 = désactivé. */
  landingDipMax: number;
  /** Vitesse d'impact verticale donnant l'enfoncement maximal, m/s. */
  landingDipFullSpeed: number;
  /** Temps de remontée de la vue après un enfoncement, en secondes (pas fixe). */
  landingDipRecoverTime: number;
}

export const moveConfig: MoveConfig = {
  walkSpeed: 9,
  runSpeed: 13,
  timeToMaxSpeed: 0.08,
  timeToStop: 0.1,
  airControl: 0.35,

  jumpHeight: 1.1,
  coyoteTime: 0,
  jumpBufferTime: 0,
  groundStickSpeed: 0.2,
  maxFallSpeed: 60,

  capsuleRadius: 0.4,
  capsuleHalfHeight: 0.6,
  eyeHeight: 1.6,
  characterMass: 80,

  colliderOffset: 0.01,
  autostepMaxHeight: 0.35,
  autostepMinWidth: 0.2,
  autostepIncludeDynamicBodies: true,
  snapToGroundDistance: 0.4,
  maxSlopeClimbAngleDeg: 50,
  minSlopeSlideAngleDeg: 55,

  lookSensitivity: 0.0025,
  pitchLimitDeg: 89.5,

  // Valeurs de départ = variante B ci-dessous (« classique »). Ce sont des
  // POINTS DE DÉPART défendables, pas un arbitrage : le choix appartient à
  // l'humain, cf. FEEL_VARIANTS.
  bobDistancePerCycle: 5,
  bobVerticalAmplitude: 0.035,
  bobLateralAmplitude: 0.025,
  bobSpeedFloor: 0.5,
  bobResponseTime: 0.12,

  fovBase: 75,
  fovRunBoost: 8,
  fovBoostStartFraction: 0.75,
  fovBoostFullFraction: 1,
  fovResponseTime: 0.22,

  landingDipMax: 0.09,
  landingDipFullSpeed: 12,
  landingDipRecoverTime: 0.35,
};

// Variantes de feel de la VUE — harnais A/B (usage, axe de comparaison) :
// see: docs/archive/systems-joueur.md#harnais-ab-feel_variants

/** Champs de vue seulement — aucune variante ne touche au déplacement. */
export type FeelVariant = Partial<
  Pick<
    MoveConfig,
    | "bobDistancePerCycle"
    | "bobVerticalAmplitude"
    | "bobLateralAmplitude"
    | "bobSpeedFloor"
    | "bobResponseTime"
    | "fovBase"
    | "fovRunBoost"
    | "fovBoostStartFraction"
    | "fovBoostFullFraction"
    | "fovResponseTime"
    | "landingDipMax"
    | "landingDipFullSpeed"
    | "landingDipRecoverTime"
  >
>;

export const FEEL_VARIANTS: Record<"A" | "B" | "C", FeelVariant> = {
  /** A — SOBRE : bob et FOV à peine perceptibles. */
  A: {
    bobDistancePerCycle: 5,
    bobVerticalAmplitude: 0.018,
    bobLateralAmplitude: 0.01,
    bobSpeedFloor: 0.5,
    bobResponseTime: 0.1,
    fovRunBoost: 3,
    fovResponseTime: 0.3,
    landingDipMax: 0.05,
    landingDipRecoverTime: 0.3,
  },

  /** B — CLASSIQUE : dosage type Quake/GoldSrc. Point de départ recommandé. */
  B: {
    bobDistancePerCycle: 5,
    bobVerticalAmplitude: 0.035,
    bobLateralAmplitude: 0.025,
    bobSpeedFloor: 0.5,
    bobResponseTime: 0.12,
    fovRunBoost: 8,
    fovResponseTime: 0.22,
    landingDipMax: 0.09,
    landingDipRecoverTime: 0.35,
  },

  /** C — CHARNU : bob et FOV marqués. Risque assumé : gêne la visée en mouvement. */
  C: {
    bobDistancePerCycle: 5,
    bobVerticalAmplitude: 0.06,
    bobLateralAmplitude: 0.048,
    bobSpeedFloor: 0.5,
    bobResponseTime: 0.16,
    fovRunBoost: 14,
    fovResponseTime: 0.16,
    landingDipMax: 0.15,
    landingDipRecoverTime: 0.45,
  },
};

// Grandeurs dérivées : recalculées à chaque pas fixe pour rester correctes si
// la config est modifiée à chaud, et indépendantes de FIXED_DT.

export function jumpVelocity(cfg: MoveConfig, gravityY: number): number {
  return Math.sqrt(2 * Math.abs(gravityY) * cfg.jumpHeight);
}

export function groundAcceleration(cfg: MoveConfig, targetSpeed: number): number {
  return cfg.timeToMaxSpeed > 0 ? targetSpeed / cfg.timeToMaxSpeed : Infinity;
}

/** Décélération horizontale au sol, en m/s², pour un arrêt complet depuis `runSpeed`. */
export function groundDeceleration(cfg: MoveConfig): number {
  return cfg.timeToStop > 0 ? cfg.runSpeed / cfg.timeToStop : Infinity;
}

/** Hauteur totale de la capsule, en mètres. */
export function capsuleTotalHeight(cfg: MoveConfig): number {
  return 2 * (cfg.capsuleHalfHeight + cfg.capsuleRadius);
}

// see: docs/archive/systems-joueur.md#distinction-mur-sol-pente-reclip-anti-vitesse-fantôme
export function wallNormalYThreshold(cfg: MoveConfig): number {
  return Math.cos((cfg.maxSlopeClimbAngleDeg * Math.PI) / 180);
}

export function eyeOffsetFromCenter(cfg: MoveConfig): number {
  return cfg.eyeHeight - (cfg.capsuleHalfHeight + cfg.capsuleRadius);
}

/** Borne `t` dans [0, 1]. */
function saturate(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function bobIntensityTarget(cfg: MoveConfig, horizontalSpeed: number, isGrounded: boolean): number {
  if (!isGrounded) return 0;
  const span = cfg.runSpeed - cfg.bobSpeedFloor;
  if (span <= 0) return horizontalSpeed > cfg.bobSpeedFloor ? 1 : 0;
  return saturate((horizontalSpeed - cfg.bobSpeedFloor) / span);
}

export function fovRunFactorTarget(cfg: MoveConfig, horizontalSpeed: number): number {
  const start = cfg.runSpeed * cfg.fovBoostStartFraction;
  const full = cfg.runSpeed * cfg.fovBoostFullFraction;
  const span = full - start;
  if (span <= 0) return horizontalSpeed >= full ? 1 : 0;
  return saturate((horizontalSpeed - start) / span);
}

/** FOV vertical, en degrés, pour un facteur de course 0..1. */
export function fovForRunFactor(cfg: MoveConfig, runFactor: number): number {
  return cfg.fovBase + cfg.fovRunBoost * runFactor;
}

export function landingDipFor(cfg: MoveConfig, impactSpeed: number): number {
  if (cfg.landingDipFullSpeed <= 0) return cfg.landingDipMax;
  return saturate(impactSpeed / cfg.landingDipFullSpeed) * cfg.landingDipMax;
}
