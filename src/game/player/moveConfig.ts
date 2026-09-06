/**
 * Paramètres de déplacement du joueur — SOURCE UNIQUE DE VÉRITÉ.
 *
 * Toutes les valeurs ci-dessous sont des POINTS DE DÉPART issus du plan, pas
 * des constantes. Elles sont là pour être tunées (agent `feel-tuner`), et
 * l'objet est volontairement mutable pour permettre l'A/B à chaud :
 *
 *     Object.assign(moveConfig, VARIANTE_B);
 *     player.applyConfig();   // requis pour les champs lus par Rapier (capsule, KCC)
 *
 * Les variantes de feel de la VUE (head bob, FOV, réception) sont fournies
 * prêtes à l'emploi en bas de fichier — `FEEL_VARIANTS`, appliquées par
 * `cassandre.applyFeelVariant("A" | "B" | "C")`.
 *
 * Règles :
 * - Aucun nombre de déplacement ne doit apparaître ailleurs que dans ce fichier.
 * - La gravité N'EST PAS ici : elle appartient au monde physique
 *   (`PhysicsWorld.gravityY`, −25 m/s²). La dupliquer désynchroniserait la
 *   chute du joueur de celle des corps dynamiques.
 * - Les grandeurs dérivées (vitesse initiale de saut, accélération,
 *   décélération) se calculent par formule à partir des champs ci-dessous —
 *   voir les helpers en bas de fichier. Ne jamais coder « 7.4 » en dur.
 */
export interface MoveConfig {
  /** Vitesse horizontale max en marche, m/s. */
  walkSpeed: number;
  /** Vitesse horizontale max en course (ShiftLeft), m/s. */
  runSpeed: number;
  /**
   * Temps pour atteindre la vitesse max au sol, en secondes.
   * Détermine l'accélération : accel = vitesseCible / timeToMaxSpeed.
   * 0 = accélération instantanée (démarrage sec, style arcade).
   */
  timeToMaxSpeed: number;
  /**
   * Temps d'arrêt complet depuis la VITESSE DE COURSE, en secondes.
   * Détermine la décélération au sol : decel = runSpeed / timeToStop.
   * Conséquence assumée : depuis la vitesse de marche, l'arrêt est
   * proportionnellement plus rapide (0.10 s × 9/13 ≈ 0.069 s).
   * Aucune friction n'est appliquée en l'air (le momentum se conserve).
   */
  timeToStop: number;
  /**
   * Contrôle aérien, en fraction de l'accélération sol (0 = aucun contrôle
   * en l'air, 1 = autant qu'au sol).
   */
  airControl: number;

  /** Hauteur de saut visée, en mètres. v₀ est dérivée de cette hauteur et de la gravité du monde. */
  jumpHeight: number;
  /**
   * Tolérance de saut après avoir quitté le sol, en secondes (« coyote time »).
   * 0 = désactivé, mécanique brute. Champ exposé pour `feel-tuner`.
   */
  coyoteTime: number;
  /**
   * Mémorisation d'un appui saut effectué juste avant de toucher le sol, en secondes.
   * 0 = désactivé, mécanique brute. Champ exposé pour `feel-tuner`.
   */
  jumpBufferTime: number;
  /**
   * Vitesse descendante appliquée en permanence quand le joueur est au sol, m/s.
   * Maintient le contact (évite un `isGrounded` qui clignote et aide le
   * snap-to-ground en descente de pente). Doit rester < snapToGroundDistance / dt.
   *
   * PLAFONNÉ BAS, et c'est mesuré, pas esthétique : ne pas remonter cette
   * valeur sans mesurer au même harnais Rapier headless que celui qui a
   * trouvé le bug. Chiffres, méthode et alternative écartée :
   * see: docs/systems/joueur.md#une-vitesse-de-collage-au-sol-volontairement-faible-groundstickspeed
   */
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
  // see: docs/systems/joueur.md#vue-head-bob-fov-dynamique-réception-de-saut

  /**
   * Distance horizontale parcourue pour UN CYCLE complet de bob, en mètres.
   * Un cycle = deux appuis de pied : oscillation verticale ×2, balancement
   * latéral ×1. Plus court = cadence plus rapide à vitesse égale.
   *
   * Attention au calibrage : le jeu court à 13 m/s, une valeur « humaine à
   * pied » y produit une cadence de mitraillette. 5 m = deux foulées de 2.5 m,
   * soit exactement l'amplitude de foulée d'un sprinteur réel à cette vitesse,
   * et ~2.6 cycles/s (5.2 appuis/s) à `runSpeed`. Une valeur de 3.4 m donnait
   * 7.7 appuis/s, très au-delà de la référence du genre (Doom : ~2 appuis/s,
   * mais à cadence FIXE, indépendante de la vitesse).
   */
  bobDistancePerCycle: number;
  /** Amplitude verticale du bob à pleine intensité, en mètres (crête). */
  bobVerticalAmplitude: number;
  /** Amplitude latérale du balancement à pleine intensité, en mètres (crête). */
  bobLateralAmplitude: number;
  /**
   * Vitesse horizontale en dessous de laquelle le bob est nul, m/s.
   * Zone morte : évite un fourmillement de la vue à vitesse résiduelle et
   * garantit une immobilité EXACTE à l'arrêt (stabilité du hash de pixels).
   */
  bobSpeedFloor: number;
  /**
   * Temps de réponse de l'enveloppe d'amplitude, en secondes (pas fixe).
   * Sert à ne pas couper le bob net au décollage ni le rallumer d'un coup à la
   * réception. 0 = commutation instantanée.
   */
  bobResponseTime: number;

  /** FOV vertical au repos, en degrés. Utilisé à la construction de la caméra. */
  fovBase: number;
  /** Élargissement maximal du FOV à pleine vitesse, en degrés (ajouté à `fovBase`). */
  fovRunBoost: number;
  /**
   * Fraction de `runSpeed` à laquelle l'élargissement COMMENCE.
   * Exprimé en fraction et non en m/s pour rester cohérent si `runSpeed` bouge.
   * 0.75 × 13 = 9.75 m/s, soit 0.75 m/s au-dessus de la vitesse de marche :
   * marcher n'élargit rien, et les micro-variations de vitesse en marche
   * (pente, frottement d'un mur) n'allument pas le FOV par intermittence.
   */
  fovBoostStartFraction: number;
  /** Fraction de `runSpeed` à laquelle l'élargissement est MAXIMAL. */
  fovBoostFullFraction: number;
  /**
   * Temps de réponse du FOV, en secondes (pas fixe). Plus haut = respiration
   * lente et discrète ; plus bas = le FOV « claque » avec la vitesse.
   */
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
// see: docs/systems/joueur.md#harnais-ab-feel_variants

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

/**
 * Vitesse verticale initiale, en m/s, pour atteindre `jumpHeight` sous
 * `gravityY` (négative). v₀ = √(2 · |g| · h) — 1.1 m sous −25 m/s² ≈ 7.42 m/s.
 */
export function jumpVelocity(cfg: MoveConfig, gravityY: number): number {
  return Math.sqrt(2 * Math.abs(gravityY) * cfg.jumpHeight);
}

/**
 * Accélération horizontale au sol, en m/s², pour atteindre `targetSpeed` en
 * `timeToMaxSpeed`. `Infinity` si le temps est nul (accélération instantanée).
 */
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

/**
 * Seuil (cosinus) qui distingue un MUR d'un simple contact de sol/pente pour
 * le reclip anti-vitesse-fantôme de `PlayerController.update`. Une collision
 * dont |normale.y| tombe SOUS ce seuil est plus raide que ce que le
 * controller sait gravir (`maxSlopeClimbAngleDeg`) : un mur quasi vertical,
 * ou une pente au-delà du seuil (y compris volontairement infranchissable,
 * comme la rampe à 55° de la gym). Réutilise `maxSlopeClimbAngleDeg` plutôt
 * qu'un second champ : c'est déjà la frontière que Rapier applique en
 * interne entre franchissable et non franchissable.
 *
 * Le bug historique que ce filtre corrige, et pourquoi le filtrer sans lui
 * cassait sol/pentes/marches : see: docs/systems/joueur.md#distinction-mur-sol-pente-reclip-anti-vitesse-fantôme
 */
export function wallNormalYThreshold(cfg: MoveConfig): number {
  return Math.cos((cfg.maxSlopeClimbAngleDeg * Math.PI) / 180);
}

/**
 * Décalage vertical entre le centre de la capsule et les yeux, en mètres.
 * Le centre de la capsule est à (halfHeight + radius) au-dessus des pieds.
 */
export function eyeOffsetFromCenter(cfg: MoveConfig): number {
  return cfg.eyeHeight - (cfg.capsuleHalfHeight + cfg.capsuleRadius);
}

/** Borne `t` dans [0, 1]. */
function saturate(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * Amplitude VISÉE du head bob, 0..1, pour une vitesse horizontale donnée.
 * En l'air le bob est nul (aucun appui de pied) ; au sol il croît de la zone
 * morte jusqu'à `runSpeed`, si bien que marcher bobe visiblement moins que
 * courir — c'est le signal de vitesse principal de la vue.
 */
export function bobIntensityTarget(
  cfg: MoveConfig,
  horizontalSpeed: number,
  isGrounded: boolean,
): number {
  if (!isGrounded) return 0;
  const span = cfg.runSpeed - cfg.bobSpeedFloor;
  if (span <= 0) return horizontalSpeed > cfg.bobSpeedFloor ? 1 : 0;
  return saturate((horizontalSpeed - cfg.bobSpeedFloor) / span);
}

/**
 * Facteur de course VISÉ, 0..1, pour une vitesse horizontale donnée.
 * Dérivé de la vitesse RÉELLE et non de la touche sprint : courir contre un
 * mur n'élargit pas le champ, puisque le controller a déjà reclippé sa vitesse
 * horizontale sur le mouvement effectivement réalisé.
 */
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

/**
 * Enfoncement de vue provoqué par une réception à `impactSpeed` m/s.
 * Linéaire depuis 0 : descendre une marche produit un micro-tassement, une
 * grande chute produit l'enfoncement maximal.
 */
export function landingDipFor(cfg: MoveConfig, impactSpeed: number): number {
  if (cfg.landingDipFullSpeed <= 0) return cfg.landingDipMax;
  return saturate(impactSpeed / cfg.landingDipFullSpeed) * cfg.landingDipMax;
}
