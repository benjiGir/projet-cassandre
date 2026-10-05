import { FIXED_DT } from "../../../core/loop/loop";
import { kickConfig } from "./kickConfig";
import type { FiringWeapon } from "./weaponTypes";

// see: docs/6-reference/notes-code-gameplay-joueur.md#tuning
export interface WeaponConfig {
  /** Portée du coup, en mètres : distance entre les yeux et le centre de la sphère de test. */
  meleeRange: number;
  meleeHitRadius: number;
  /** Temps entre deux coups, en secondes. Bloque uniquement le PROCHAIN coup, jamais le mouvement (invariant #10). */
  meleeCooldown: number;
  /** Dégâts par coup. Placeholder : aucun ennemi n'existe encore pour les consommer (Phase 3). */
  meleeDamage: number;

  pistolCooldown: number;
  /** Portée du rayon, en mètres. Plus loin que le pompe : c'est l'arme de la distance. */
  pistolRange: number;
  pistolDamage: number;
  /** Dispersion, demi-angle en degrés. Faible mais non nulle : tirer vite doit coûter en précision. */
  pistolSpreadDeg: number;
  /** Munitions données par le ramassage de l'arme. */
  pistolStartingAmmo: number;
  /** Plafond de munitions : une boîte ramassée au-delà est perdue (elle reste au sol). */
  pistolMaxAmmo: number;

  /** Nombre de plombs par tir. PRESCRIT par le plan — ne pas retoucher ici. */
  shotgunPelletCount: number;
  /** Demi-angle du cône de dispersion, en degrés. PRESCRIT par le plan — ne pas retoucher ici. */
  shotgunSpreadConeDeg: number;
  shotgunCooldown: number;
  /** Portée maximale des raycasts de plombs, en mètres. */
  shotgunRange: number;
  /** Dégâts par plomb touché. Placeholder : aucun ennemi n'existe encore pour les consommer. */
  shotgunDamagePerPellet: number;
  shotgunMagazineSize: number;
  shotgunStartingAmmo: number;

  /** Kick de recul du pied-de-biche à la frappe. Récupéré par rampe linéaire (`approach()`), au dt de gameplay. */
  meleeRecoil: RecoilKick;
  /** Kick de recul du pistolet. Bien plus sec et court que celui du pompe. */
  pistolRecoil: RecoilKick;
  /** Kick de recul du pompe au tir. Même mécanique que `meleeRecoil`. */
  shotgunRecoil: RecoilKick;
  recoilPositionInterpolated: boolean;

  // see: docs/archive/systems-armes.md#matériau-perçu-et-hitstop-murennemi
  hitstopDuration: number;
  hitstopScale: number;
  enemyHitstopDuration: number;
  /** Échelle de dt pendant le hitstop ENEMY. Valeur de départ = IDENTIQUE à `hitstopScale`, même raison que `enemyHitstopDuration`. */
  enemyHitstopScale: number;

  /** Amplitude du screenshake GÉNÉRIQUE, en mètres (ou unité équivalente choisie par `retro-render`). PRESCRIT. */
  shakeAmplitude: number;
  /** Durée du screenshake GÉNÉRIQUE, en secondes. PRESCRIT (120 ms). */
  shakeDuration: number;
  /** Amplitude du screenshake sur un hit ENEMY confirmé. Valeur de départ = IDENTIQUE à `shakeAmplitude`. */
  enemyShakeAmplitude: number;
  /** Durée du screenshake sur un hit ENEMY confirmé. Valeur de départ = IDENTIQUE à `shakeDuration`. */
  enemyShakeDuration: number;

  // see: docs/archive/systems-armes.md#confirmation-de-hit-à-lécran-hitmarker_variants
  /** Active/désactive le hitmarker. Désactivé par défaut, voir note ci-dessus. */
  hitmarkerEnabled: boolean;
  /** Durée d'affichage du marqueur sur un hit simple, en secondes. */
  hitmarkerDuration: number;
  /** Demi-longueur des branches de la croix, en pixels internes (résolution 640×360, voir invariant #4). */
  hitmarkerSize: number;
  /** Épaisseur des branches, en pixels internes. */
  hitmarkerThickness: number;
  /** Couleur du marqueur sur un hit simple (hex 0xRRGGBB). */
  hitmarkerColor: number;
  /** Durée d'affichage du marqueur sur un KILL (Costard tué), en secondes. */
  hitmarkerKillDuration: number;
  /** Demi-longueur des branches sur un KILL, en pixels internes — généralement > `hitmarkerSize`. */
  hitmarkerKillSize: number;
  /** Épaisseur des branches sur un KILL, en pixels internes. */
  hitmarkerKillThickness: number;
  /** Couleur du marqueur sur un KILL (hex 0xRRGGBB) — généralement distincte de `hitmarkerColor`. */
  hitmarkerKillColor: number;

  // see: docs/archive/systems-armes.md#réticule-permanent-crosshair_variants
  /** Active/désactive le réticule permanent. Activé par défaut (demande explicite du playtest, pas un choix de feel). */
  crosshairEnabled: boolean;
  /** Forme du réticule. */
  crosshairStyle: "cross" | "dot";
  /** Demi-longueur des branches (style croix), en pixels internes (résolution 640×360). */
  crosshairSize: number;
  /** Espace central entre les branches (style croix), en pixels internes. */
  crosshairGap: number;
  /** Épaisseur des branches/du trait, en pixels internes. */
  crosshairThickness: number;
  /** Rayon du point (style point), en pixels internes. */
  crosshairDotRadius: number;
  /** Couleur du réticule (hex 0xRRGGBB). */
  crosshairColor: number;
  crosshairPulseEnabled: boolean;
  /** Facteur d'échelle au pic de la pulsation (1 = pas de pulsation visible). */
  crosshairPulseScale: number;
  /** Temps de retour à l'échelle 1 depuis le pic, en secondes (rampe linéaire, même mécanique que `RecoilKick.recoverTime`). */
  crosshairPulseDuration: number;
}

export interface RecoilKick {
  /** Décalage horizontal (droite +), en mètres, dans le repère de la vue. */
  kickX: number;
  /** Décalage vertical (haut +), en mètres. */
  kickY: number;
  /** Décalage vers la caméra (recul du canon/de l'outil), en mètres. */
  kickZ: number;
  /** Rotation de tangage instantanée, en degrés. Positif = le canon se relève. */
  kickPitchDeg: number;
  /** Temps de retour à zéro DEPUIS cette amplitude, en secondes (rampe linéaire au pas fixe). */
  recoverTime: number;
}

const DEFAULT_HITSTOP_FRAMES = 3;

export const weaponConfig: WeaponConfig = {
  meleeRange: 2,
  meleeHitRadius: 0.45,
  meleeCooldown: 0.5,
  meleeDamage: 40,

  pistolCooldown: 0.22,
  pistolRange: 60,
  pistolDamage: 12,
  pistolSpreadDeg: 0.8,
  pistolStartingAmmo: 48,
  pistolMaxAmmo: 150,

  shotgunPelletCount: 9,
  shotgunSpreadConeDeg: 5,
  shotgunCooldown: 0.8,
  shotgunRange: 30,
  shotgunDamagePerPellet: 6,
  shotgunMagazineSize: 6,
  shotgunStartingAmmo: 48,

  // Valeurs de départ = variante B ci-dessous (« classique »), même
  // convention que `moveConfig`/`FEEL_VARIANTS`.
  meleeRecoil: { kickX: 0, kickY: -0.035, kickZ: 0.05, kickPitchDeg: 5, recoverTime: 0.18 },
  pistolRecoil: { kickX: 0, kickY: 0.012, kickZ: 0.05, kickPitchDeg: 3, recoverTime: 0.12 },
  shotgunRecoil: { kickX: 0, kickY: 0.025, kickZ: 0.14, kickPitchDeg: 7, recoverTime: 0.22 },
  recoilPositionInterpolated: true,

  hitstopDuration: DEFAULT_HITSTOP_FRAMES * FIXED_DT,
  hitstopScale: 0.05,
  // Départ = IDENTIQUE au générique (variante "A — UNIFORME" de
  // `IMPACT_VARIANTS`) : livrer cette distinction ne doit rien changer au
  // feedback perçu tant qu'un humain n'a pas choisi une autre variante.
  enemyHitstopDuration: DEFAULT_HITSTOP_FRAMES * FIXED_DT,
  enemyHitstopScale: 0.05,

  shakeAmplitude: 0.15,
  shakeDuration: 0.12,
  enemyShakeAmplitude: 0.15,
  enemyShakeDuration: 0.12,

  // Hitmarker désactivé par défaut (voir doc du champ) ; valeurs ci-dessous
  // valables dès activation. Repères de départ : croix CS/Quake-like, hit
  // blanc discret, kill rouge plus marqué.
  hitmarkerEnabled: false,
  hitmarkerDuration: 0.1,
  hitmarkerSize: 6,
  hitmarkerThickness: 2,
  hitmarkerColor: 0xffffff,
  hitmarkerKillDuration: 0.22,
  hitmarkerKillSize: 9,
  hitmarkerKillThickness: 3,
  hitmarkerKillColor: 0xff3b30,

  // Réticule activé par défaut (voir doc du champ) : croix fine et neutre,
  // sans pulsation — point de départ du harnais, pas une valeur tranchée.
  crosshairEnabled: true,
  crosshairStyle: "cross",
  crosshairSize: 4,
  crosshairGap: 2,
  crosshairThickness: 1,
  crosshairDotRadius: 1,
  crosshairColor: 0x00ff66,
  crosshairPulseEnabled: false,
  crosshairPulseScale: 1.4,
  crosshairPulseDuration: 0.08,
};

export function damageForWeapon(weapon: FiringWeapon): number {
  if (weapon === "kick") return kickConfig.damage;
  if (weapon === "shotgun") return weaponConfig.shotgunDamagePerPellet;
  if (weapon === "pistol") return weaponConfig.pistolDamage;
  return weaponConfig.meleeDamage;
}

/** Dégâts d'un impact : la table ci-dessus, et le multiplicateur que le coup porte. */
export function damageForHit(hit: { weapon: FiringWeapon; damageScale?: number }): number {
  return damageForWeapon(hit.weapon) * (hit.damageScale ?? 1);
}

// Variantes de recul — harnais A/B, même mécanique que `FEEL_VARIANTS` dans
// `moveConfig.ts`. Axe, usage console et protocole F9/F10 :
// see: docs/archive/systems-armes.md#recul-du-viewmodel-recoil_variants

export interface RecoilVariant {
  meleeRecoil: RecoilKick;
  /** Le pistolet suit la même échelle que les deux autres, en plus sec. */
  pistolRecoil: RecoilKick;
  shotgunRecoil: RecoilKick;
}

export const RECOIL_INTERPOLATION_VARIANTS = {
  STABLE: { recoilPositionInterpolated: true },
  HISTORIQUE: { recoilPositionInterpolated: false },
} as const;

export const RECOIL_VARIANTS: Record<"A" | "B" | "C", RecoilVariant> = {
  /** A — DISCIPLINÉ : kick court, récupération rapide. Risque : peut se sentir mou. */
  A: {
    meleeRecoil: { kickX: 0, kickY: -0.015, kickZ: 0.02, kickPitchDeg: 2, recoverTime: 0.1 },
    pistolRecoil: { kickX: 0, kickY: 0.006, kickZ: 0.025, kickPitchDeg: 1.5, recoverTime: 0.08 },
    shotgunRecoil: { kickX: 0, kickY: 0.012, kickZ: 0.07, kickPitchDeg: 3, recoverTime: 0.14 },
  },

  /** B — CLASSIQUE : kick net sans perte de cible prolongée. Point de départ recommandé. */
  B: {
    meleeRecoil: { kickX: 0, kickY: -0.035, kickZ: 0.05, kickPitchDeg: 5, recoverTime: 0.18 },
    pistolRecoil: { kickX: 0, kickY: 0.012, kickZ: 0.05, kickPitchDeg: 3, recoverTime: 0.12 },
    shotgunRecoil: { kickX: 0, kickY: 0.025, kickZ: 0.14, kickPitchDeg: 7, recoverTime: 0.22 },
  },

  /** C — LOURD : poids visible sur les deux armes. Risque : retarde le tir suivant/la réacquisition. */
  C: {
    meleeRecoil: { kickX: 0, kickY: -0.06, kickZ: 0.09, kickPitchDeg: 9, recoverTime: 0.28 },
    pistolRecoil: { kickX: 0, kickY: 0.022, kickZ: 0.09, kickPitchDeg: 5, recoverTime: 0.2 },
    shotgunRecoil: { kickX: 0, kickY: 0.045, kickZ: 0.22, kickPitchDeg: 12, recoverTime: 0.32 },
  },
};

// see: docs/archive/systems-armes.md#hitstop-et-shake-murennemi-impact_variants

export interface ImpactVariant {
  hitstopDuration: number;
  hitstopScale: number;
  enemyHitstopDuration: number;
  enemyHitstopScale: number;
  shakeAmplitude: number;
  shakeDuration: number;
  enemyShakeAmplitude: number;
  enemyShakeDuration: number;
}

export const IMPACT_VARIANTS: Record<"A" | "B" | "C", ImpactVariant> = {
  /** A — UNIFORME : hit mur et hit ennemi identiques (comportement d'avant). Repère de contrôle. */
  A: {
    hitstopDuration: DEFAULT_HITSTOP_FRAMES * FIXED_DT,
    hitstopScale: 0.05,
    enemyHitstopDuration: DEFAULT_HITSTOP_FRAMES * FIXED_DT,
    enemyHitstopScale: 0.05,
    shakeAmplitude: 0.15,
    shakeDuration: 0.12,
    enemyShakeAmplitude: 0.15,
    enemyShakeDuration: 0.12,
  },

  /** B — SIGNAL RENFORCÉ : hit mur inchangé, hit ennemi ~60 % plus long / ~50 % plus ample. */
  B: {
    hitstopDuration: DEFAULT_HITSTOP_FRAMES * FIXED_DT,
    hitstopScale: 0.05,
    enemyHitstopDuration: 5 * FIXED_DT,
    enemyHitstopScale: 0.04,
    shakeAmplitude: 0.15,
    shakeDuration: 0.12,
    enemyShakeAmplitude: 0.22,
    enemyShakeDuration: 0.16,
  },

  /** C — PUNCHY EXTRÊME : hitstop quasi doublé, shake ×2. Risque : désorientant en combat groupé. */
  C: {
    hitstopDuration: DEFAULT_HITSTOP_FRAMES * FIXED_DT,
    hitstopScale: 0.05,
    enemyHitstopDuration: 6 * FIXED_DT,
    enemyHitstopScale: 0.03,
    shakeAmplitude: 0.15,
    shakeDuration: 0.12,
    enemyShakeAmplitude: 0.3,
    enemyShakeDuration: 0.2,
  },
};

// Variantes de hitmarker — harnais A/B, canal de feedback absent du jeu
// jusqu'à son ajout en Phase 3. Axe, usage console :

export interface HitmarkerVariant {
  hitmarkerEnabled: boolean;
  hitmarkerDuration: number;
  hitmarkerSize: number;
  hitmarkerThickness: number;
  hitmarkerColor: number;
  hitmarkerKillDuration: number;
  hitmarkerKillSize: number;
  hitmarkerKillThickness: number;
  hitmarkerKillColor: number;
}

export const HITMARKER_VARIANTS: Record<"OFF" | "SOBRE" | "ARCADE", HitmarkerVariant> = {
  /** OFF — aucun marqueur. Seul le sprite (flash) et le son confirment le hit. Repère de contrôle. */
  OFF: {
    hitmarkerEnabled: false,
    hitmarkerDuration: 0.1,
    hitmarkerSize: 6,
    hitmarkerThickness: 2,
    hitmarkerColor: 0xffffff,
    hitmarkerKillDuration: 0.22,
    hitmarkerKillSize: 9,
    hitmarkerKillThickness: 3,
    hitmarkerKillColor: 0xff3b30,
  },

  /** SOBRE — petite croix blanche discrète sur un hit, rouge et plus grande sur un kill. */
  SOBRE: {
    hitmarkerEnabled: true,
    hitmarkerDuration: 0.1,
    hitmarkerSize: 6,
    hitmarkerThickness: 2,
    hitmarkerColor: 0xffffff,
    hitmarkerKillDuration: 0.22,
    hitmarkerKillSize: 9,
    hitmarkerKillThickness: 3,
    hitmarkerKillColor: 0xff3b30,
  },

  /** ARCADE — marqueur plus grand/épais/tenu plus longtemps. Risque : criard, « jeu mobile ». */
  ARCADE: {
    hitmarkerEnabled: true,
    hitmarkerDuration: 0.16,
    hitmarkerSize: 10,
    hitmarkerThickness: 3,
    hitmarkerColor: 0xffe680,
    hitmarkerKillDuration: 0.35,
    hitmarkerKillSize: 16,
    hitmarkerKillThickness: 4,
    hitmarkerKillColor: 0xff3b30,
  },
};


export interface CrosshairVariant {
  crosshairEnabled: boolean;
  crosshairStyle: "cross" | "dot";
  crosshairSize: number;
  crosshairGap: number;
  crosshairThickness: number;
  crosshairDotRadius: number;
  crosshairColor: number;
  crosshairPulseEnabled: boolean;
  crosshairPulseScale: number;
  crosshairPulseDuration: number;
}

export const CROSSHAIR_VARIANTS: Record<"CROIX_STATIQUE" | "POINT" | "CROIX_RESPIRATION", CrosshairVariant> = {
  /** CROIX_STATIQUE — croix fine verte immobile, façon Quake/Half-Life 1. Point de départ recommandé. */
  CROIX_STATIQUE: {
    crosshairEnabled: true,
    crosshairStyle: "cross",
    crosshairSize: 4,
    crosshairGap: 2,
    crosshairThickness: 1,
    crosshairDotRadius: 1,
    crosshairColor: 0x00ff66,
    crosshairPulseEnabled: false,
    crosshairPulseScale: 1.4,
    crosshairPulseDuration: 0.08,
  },

  /** POINT — point blanc minimal, façon Build engine. Risque : moins visible sur fond clair/texturé. */
  POINT: {
    crosshairEnabled: true,
    crosshairStyle: "dot",
    crosshairSize: 4,
    crosshairGap: 2,
    crosshairThickness: 1,
    crosshairDotRadius: 1,
    crosshairColor: 0xffffff,
    crosshairPulseEnabled: false,
    crosshairPulseScale: 1.4,
    crosshairPulseDuration: 0.08,
  },

  /** CROIX_RESPIRATION — sursaut d'échelle à chaque tir. Risque : ajoute du mouvement là où l'œil doit rester stable. */
  CROIX_RESPIRATION: {
    crosshairEnabled: true,
    crosshairStyle: "cross",
    crosshairSize: 5,
    crosshairGap: 2,
    crosshairThickness: 1,
    crosshairDotRadius: 1,
    crosshairColor: 0x00ff66,
    crosshairPulseEnabled: true,
    crosshairPulseScale: 1.5,
    crosshairPulseDuration: 0.1,
  },
};
