import type { TuningField, MoveField, FieldGroup, ImpactKey, HitmarkerKey, CrosshairKey, SuitFeedbackKey } from "./tuningTypes";

// see: docs/archive/systems-hud.md#panneau-de-tuning-à-chaud

export const MOVE_GROUPS: ReadonlyArray<FieldGroup<MoveField>> = [
  {
    title: "Vitesses",
    fields: [
      { key: "walkSpeed", label: "Vitesse marche", min: 0, max: 20, step: 0.5, decimals: 1, unit: "m/s" },
      { key: "runSpeed", label: "Vitesse course", min: 0, max: 25, step: 0.5, decimals: 1, unit: "m/s" },
      { key: "timeToMaxSpeed", label: "Temps → vitesse max", min: 0, max: 0.5, step: 0.01, decimals: 2, unit: "s" },
      { key: "timeToStop", label: "Temps d'arrêt (depuis la course)", min: 0, max: 0.5, step: 0.01, decimals: 2, unit: "s" },
      { key: "airControl", label: "Contrôle aérien", min: 0, max: 1, step: 0.05, decimals: 2 },
    ],
  },
  {
    title: "Saut",
    fields: [
      { key: "jumpHeight", label: "Hauteur de saut", min: 0, max: 3, step: 0.05, decimals: 2, unit: "m" },
      { key: "coyoteTime", label: "Coyote time", min: 0, max: 0.3, step: 0.01, decimals: 2, unit: "s" },
      { key: "jumpBufferTime", label: "Jump buffer", min: 0, max: 0.3, step: 0.01, decimals: 2, unit: "s" },
      // see: docs/archive/systems-joueur.md#une-vitesse-de-collage-au-sol-volontairement-faible-groundstickspeed
      { key: "groundStickSpeed", label: "Collage au sol", min: 0, max: 0.6, step: 0.02, decimals: 2, unit: "m/s" },
      { key: "maxFallSpeed", label: "Vitesse de chute max", min: 10, max: 100, step: 1, decimals: 0, unit: "m/s" },
    ],
  },
  {
    title: "Capsule",
    fields: [
      { key: "capsuleRadius", label: "Rayon capsule ⚙", min: 0.2, max: 0.8, step: 0.01, decimals: 2, unit: "m", requiresApplyConfig: true },
      { key: "capsuleHalfHeight", label: "Demi-hauteur capsule ⚙", min: 0.2, max: 1.2, step: 0.01, decimals: 2, unit: "m", requiresApplyConfig: true },
      { key: "eyeHeight", label: "Hauteur des yeux", min: 1.0, max: 2.2, step: 0.01, decimals: 2, unit: "m" },
      { key: "characterMass", label: "Masse ⚙", min: 20, max: 150, step: 1, decimals: 0, unit: "kg", requiresApplyConfig: true },
    ],
  },
  {
    title: "Character controller (Rapier KCC)",
    fields: [
      { key: "colliderOffset", label: "Marge collider ⚙", min: 0.001, max: 0.05, step: 0.001, decimals: 3, unit: "m", requiresApplyConfig: true },
      { key: "autostepMaxHeight", label: "Autostep — hauteur max ⚙", min: 0, max: 0.6, step: 0.01, decimals: 2, unit: "m", requiresApplyConfig: true },
      { key: "autostepMinWidth", label: "Autostep — largeur min ⚙", min: 0.05, max: 0.5, step: 0.01, decimals: 2, unit: "m", requiresApplyConfig: true },
      { key: "snapToGroundDistance", label: "Snap au sol ⚙", min: 0, max: 0.6, step: 0.01, decimals: 2, unit: "m", requiresApplyConfig: true },
      { key: "maxSlopeClimbAngleDeg", label: "Pente grimpable max ⚙", min: 0, max: 89, step: 1, decimals: 0, unit: "°", requiresApplyConfig: true },
      { key: "minSlopeSlideAngleDeg", label: "Pente de glisse min ⚙", min: 0, max: 90, step: 1, decimals: 0, unit: "°", requiresApplyConfig: true },
    ],
  },
  {
    title: "Visée",
    fields: [
      { key: "lookSensitivity", label: "Sensibilité souris", min: 0.0005, max: 0.01, step: 0.0001, decimals: 4, unit: "rad/px" },
      { key: "pitchLimitDeg", label: "Limite de pitch", min: 45, max: 89.9, step: 0.5, decimals: 1, unit: "°" },
    ],
  },
  {
    title: "Head bob",
    fields: [
      { key: "bobDistancePerCycle", label: "Distance par cycle", min: 3, max: 8, step: 0.1, decimals: 1, unit: "m" },
      { key: "bobVerticalAmplitude", label: "Amplitude verticale", min: 0, max: 0.1, step: 0.005, decimals: 3, unit: "m" },
      { key: "bobLateralAmplitude", label: "Amplitude latérale", min: 0, max: 0.06, step: 0.005, decimals: 3, unit: "m" },
      { key: "bobSpeedFloor", label: "Seuil de vitesse (zone morte)", min: 0, max: 3, step: 0.1, decimals: 1, unit: "m/s" },
      { key: "bobResponseTime", label: "Temps de réponse", min: 0, max: 0.3, step: 0.01, decimals: 2, unit: "s" },
    ],
  },
  {
    title: "FOV dynamique",
    fields: [
      { key: "fovBase", label: "FOV au repos", min: 60, max: 110, step: 1, decimals: 0, unit: "°" },
      { key: "fovRunBoost", label: "Élargissement max", min: 0, max: 20, step: 1, decimals: 0, unit: "°" },
      { key: "fovBoostStartFraction", label: "Début (fraction runSpeed)", min: 0, max: 1, step: 0.05, decimals: 2 },
      { key: "fovBoostFullFraction", label: "Plein (fraction runSpeed)", min: 0, max: 1, step: 0.05, decimals: 2 },
      { key: "fovResponseTime", label: "Temps de réponse", min: 0.05, max: 0.5, step: 0.01, decimals: 2, unit: "s" },
    ],
  },
  {
    title: "Réception de saut",
    fields: [
      { key: "landingDipMax", label: "Enfoncement max", min: 0, max: 0.25, step: 0.01, decimals: 2, unit: "m" },
      { key: "landingDipFullSpeed", label: "Vitesse d'impact — plein effet", min: 1, max: 30, step: 1, decimals: 0, unit: "m/s" },
      { key: "landingDipRecoverTime", label: "Temps de remontée", min: 0, max: 1, step: 0.05, decimals: 2, unit: "s" },
    ],
  },
];

export const IMPACT_FIELDS: ReadonlyArray<TuningField<ImpactKey>> = [
  { key: "hitstopDuration", label: "Hitstop — durée (mur/générique)", min: 0, max: 0.15, step: 0.005, decimals: 3, unit: "s" },
  { key: "hitstopScale", label: "Hitstop — échelle dt (mur/générique)", min: 0, max: 1, step: 0.01, decimals: 2 },
  { key: "enemyHitstopDuration", label: "Hitstop — durée (ennemi)", min: 0, max: 0.2, step: 0.005, decimals: 3, unit: "s" },
  { key: "enemyHitstopScale", label: "Hitstop — échelle dt (ennemi)", min: 0, max: 1, step: 0.01, decimals: 2 },
  { key: "shakeAmplitude", label: "Shake — amplitude (mur/générique)", min: 0, max: 0.4, step: 0.01, decimals: 2, unit: "m" },
  { key: "shakeDuration", label: "Shake — durée (mur/générique)", min: 0, max: 0.4, step: 0.01, decimals: 2, unit: "s" },
  { key: "enemyShakeAmplitude", label: "Shake — amplitude (ennemi)", min: 0, max: 0.4, step: 0.01, decimals: 2, unit: "m" },
  { key: "enemyShakeDuration", label: "Shake — durée (ennemi)", min: 0, max: 0.4, step: 0.01, decimals: 2, unit: "s" },
];

export const HITMARKER_FIELDS: ReadonlyArray<TuningField<HitmarkerKey>> = [
  { key: "hitmarkerDuration", label: "Durée (hit)", min: 0.02, max: 0.4, step: 0.01, decimals: 2, unit: "s" },
  { key: "hitmarkerSize", label: "Taille (hit)", min: 2, max: 20, step: 1, decimals: 0, unit: "px" },
  { key: "hitmarkerThickness", label: "Épaisseur (hit)", min: 1, max: 6, step: 1, decimals: 0, unit: "px" },
  { key: "hitmarkerKillDuration", label: "Durée (kill)", min: 0.02, max: 0.6, step: 0.01, decimals: 2, unit: "s" },
  { key: "hitmarkerKillSize", label: "Taille (kill)", min: 2, max: 30, step: 1, decimals: 0, unit: "px" },
  { key: "hitmarkerKillThickness", label: "Épaisseur (kill)", min: 1, max: 8, step: 1, decimals: 0, unit: "px" },
];

export const CROSSHAIR_FIELDS: ReadonlyArray<TuningField<CrosshairKey>> = [
  { key: "crosshairSize", label: "Taille (croix)", min: 1, max: 16, step: 1, decimals: 0, unit: "px" },
  { key: "crosshairGap", label: "Espace central (croix)", min: 0, max: 8, step: 1, decimals: 0, unit: "px" },
  { key: "crosshairThickness", label: "Épaisseur", min: 1, max: 4, step: 1, decimals: 0, unit: "px" },
  { key: "crosshairDotRadius", label: "Rayon (point)", min: 1, max: 6, step: 1, decimals: 0, unit: "px" },
  { key: "crosshairPulseScale", label: "Pulsation — échelle au pic", min: 1, max: 2, step: 0.05, decimals: 2 },
  { key: "crosshairPulseDuration", label: "Pulsation — retour à 0", min: 0.02, max: 0.3, step: 0.01, decimals: 2, unit: "s" },
];

export const SUIT_FEEDBACK_FIELDS: ReadonlyArray<TuningField<SuitFeedbackKey>> = [
  { key: "knockbackSpeed", label: "Knockback — vitesse", min: 0, max: 12, step: 0.5, decimals: 1, unit: "m/s" },
  { key: "knockbackDecayTime", label: "Knockback — retour à 0", min: 0.05, max: 0.8, step: 0.01, decimals: 2, unit: "s" },
  { key: "knockbackUpBoost", label: "Knockback — pop vertical", min: 0, max: 5, step: 0.1, decimals: 1, unit: "m/s" },
  { key: "hitFlashDuration", label: "Flash de dégât — durée", min: 0.05, max: 0.6, step: 0.01, decimals: 2, unit: "s" },
];
