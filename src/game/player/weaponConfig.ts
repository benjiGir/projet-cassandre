import { FIXED_DT } from "../../core/loop";

/**
 * Paramètres d'armes — SOURCE UNIQUE DE VÉRITÉ, même convention que
 * `moveConfig.ts` : objet mutable, tunable à chaud (console `cassandre.weaponConfig.xxx = …`),
 * aucun nombre d'arme codé en dur ailleurs que dans ce fichier.
 *
 * Comme pour `moveConfig`, toutes ces valeurs sont des POINTS DE DÉPART — y
 * compris celles présentées comme « défaut » ci-dessous — sauf les trois
 * exceptions explicitement prescrites par le plan et marquées comme telles :
 * `shotgunPelletCount`, `shotgunSpreadConeDeg`, `shakeAmplitude`,
 * `shakeDuration`. Le reste attend l'arbitrage humain (`feel-tuner`).
 */
export interface WeaponConfig {
  /** Portée du coup, en mètres : distance entre les yeux et le centre de la sphère de test. */
  meleeRange: number;
  /**
   * Rayon de la sphère de test d'impact, en mètres. Le coup n'est PAS un
   * raycast : c'est une requête de forme (`world.intersectionsWithShape`)
   * centrée à `eyeOrigin + direction * meleeRange`, ce qui pardonne un léger
   * défaut de visée — cohérent avec une arme de contact.
   */
  meleeHitRadius: number;
  /** Temps entre deux coups, en secondes. Bloque uniquement le PROCHAIN coup, jamais le mouvement (invariant #10). */
  meleeCooldown: number;
  /** Dégâts par coup. Placeholder : aucun ennemi n'existe encore pour les consommer (Phase 3). */
  meleeDamage: number;

  /**
   * Pistolet (2026-09-16) : l'arme de milieu de gamme entre le pied-de-biche
   * et le pompe. Tire un seul rayon, vite, peu fort — cinq balles pour un
   * Costard (50 PV), contre un tir de pompe à bout portant.
   */
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
  /**
   * Temps de réarmement entre deux tirs, en secondes. Minuteur PUR : il
   * bloque uniquement le prochain appel à `fire`, jamais `frame.forward` /
   * `back` / `left` / `right`. C'est le piège explicite du plan — « le pompe
   * se réarme pendant qu'on bouge » — donc ce champ ne doit JAMAIS être lu
   * ailleurs que dans la décision « peut-on tirer maintenant ».
   */
  shotgunCooldown: number;
  /** Portée maximale des raycasts de plombs, en mètres. */
  shotgunRange: number;
  /** Dégâts par plomb touché. Placeholder : aucun ennemi n'existe encore pour les consommer. */
  shotgunDamagePerPellet: number;
  /**
   * Taille d'un chargeur, en cartouches. INFORMATIF cette phase : aucun
   * mécanisme de rechargement par magasin n'est implémenté (voir
   * `shotgunStartingAmmo`). Conservé pour que Phase 6 (HUD) puisse grouper
   * l'affichage des munitions par salves de cette taille sans changer l'API
   * de `WeaponSystem`.
   */
  shotgunMagazineSize: number;
  /**
   * Munitions FINIES au spawn, réserve unique (pas de distinction
   * magasin/réserve ce prototype — voir la note d'architecture dans
   * `weapons.ts`). Nécessaire pour que le critère de validation « vider un
   * chargeur » ait un sens : à 0, `fire` ne fait rien (pas de crash, pas
   * d'animation bloquante — un futur son de clic à sec est un stretch, pas
   * une obligation).
   */
  shotgunStartingAmmo: number;

  /** Kick de recul du pied-de-biche à la frappe. Récupéré par rampe linéaire (`approach()`), au dt de gameplay. */
  meleeRecoil: RecoilKick;
  /** Kick de recul du pistolet. Bien plus sec et court que celui du pompe. */
  pistolRecoil: RecoilKick;
  /** Kick de recul du pompe au tir. Même mécanique que `meleeRecoil`. */
  shotgunRecoil: RecoilKick;

  /**
   * Durée du gel d'impact GÉNÉRIQUE (n'importe quel collider touché — mur,
   * boîte de la gym, matière indifférenciée), en secondes. Le plan prescrit
   * 3 frames à 60 Hz = exactement `3 * FIXED_DT` (`DEFAULT_HITSTOP_FRAMES`
   * plus bas, pour ne jamais coder `0.05` en dur) ; reste TUNABLE à chaud —
   * changer `hitstopDuration` directement est la façon normale de le retuner.
   *
   * Distinction mur/ennemi (pourquoi `enemyHitstopDuration` existe) :
   * see: docs/systems/armes.md#matériau-perçu-et-hitstop-murennemi
   */
  hitstopDuration: number;
  /**
   * Échelle appliquée au dt de gameplay pendant le hitstop GÉNÉRIQUE (0 = pas
   * fixe figé, 1 = pas de ralenti). Le plan ne prescrit aucune valeur ;
   * reprend le défaut de `GameClock.triggerHitstop` (0.05) SANS le trancher —
   * champ exposé pour l'arbitrage humain.
   */
  hitstopScale: number;
  /**
   * Durée du gel d'impact sur un hit ENEMY confirmé (collider `GROUP.ENEMY`),
   * en secondes. Valeur de départ = IDENTIQUE à `hitstopDuration` (aucun
   * changement de comportement tant qu'un humain n'a pas choisi une variante
   * `IMPACT_VARIANTS` différente de « A — UNIFORME ») — voir la note de
   * distinction mur/ennemi ci-dessus.
   */
  enemyHitstopDuration: number;
  /** Échelle de dt pendant le hitstop ENEMY. Valeur de départ = IDENTIQUE à `hitstopScale`, même raison que `enemyHitstopDuration`. */
  enemyHitstopScale: number;

  // Déclenchement uniquement : l'implémentation du shake appartient à
  // `retro-render`. `shakeAmplitude`/`shakeDuration` sont PRESCRITS par le
  // plan ; les deux champs `enemy*` ci-dessous ne le sont pas (candidats de
  // variante, voir IMPACT_VARIANTS).
  /** Amplitude du screenshake GÉNÉRIQUE, en mètres (ou unité équivalente choisie par `retro-render`). PRESCRIT. */
  shakeAmplitude: number;
  /** Durée du screenshake GÉNÉRIQUE, en secondes. PRESCRIT (120 ms). */
  shakeDuration: number;
  /** Amplitude du screenshake sur un hit ENEMY confirmé. Valeur de départ = IDENTIQUE à `shakeAmplitude`. */
  enemyShakeAmplitude: number;
  /** Durée du screenshake sur un hit ENEMY confirmé. Valeur de départ = IDENTIQUE à `shakeDuration`. */
  enemyShakeDuration: number;

  // Canal de feedback nouveau en Phase 3 (angle mort identifié en playtest),
  // désactivé par défaut volontairement — pourquoi, et le contrat avec
  // `render/hitmarker.ts` :
  // see: docs/systems/armes.md#confirmation-de-hit-à-lécran-hitmarker_variants
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

  // Contrairement au hitmarker, demande EXPLICITE du playtest : activé par
  // défaut. Sa position au centre exact du canvas est une CORRECTITUDE
  // géométrique, pas une variante — preuve complète :
  // see: docs/systems/armes.md#réticule-permanent-crosshair_variants
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
  /**
   * Active une légère pulsation d'échelle du réticule à CHAQUE tir déclenché
   * (`weapons.fireEvents`, indépendamment d'un hit) — un retour visuel « le
   * coup est parti », distinct du hitmarker qui ne confirme qu'un HIT.
   */
  crosshairPulseEnabled: boolean;
  /** Facteur d'échelle au pic de la pulsation (1 = pas de pulsation visible). */
  crosshairPulseScale: number;
  /** Temps de retour à l'échelle 1 depuis le pic, en secondes (rampe linéaire, même mécanique que `RecoilKick.recoverTime`). */
  crosshairPulseDuration: number;
}

/**
 * Kick de recul du viewmodel : translation + rotation instantanées à
 * l'instant du tir, récupérées par une rampe LINÉAIRE (`approach()`, même
 * fonction que `bobIntensity`/`landingDip` dans `controller.ts`) au dt de
 * gameplay — donc naturellement ralenties par le hitstop, c'est l'effet
 * voulu. AUCUNE horloge murale.
 */
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

/**
 * Nombre de frames à 60 Hz derrière la valeur de départ de `hitstopDuration`
 * (3 frames = 50 ms, prescrit par le plan). Constante d'ORIGINE, pas un
 * champ tunable indépendant : la retoucher ici ne change rien à
 * `weaponConfig.hitstopDuration` une fois le module chargé, elle documente
 * juste d'où vient `0.05`.
 */
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

/**
 * Dégâts d'UN impact, par arme. Une table plutôt qu'un ternaire recopié dans
 * chaque manager d'ennemi : avec trois armes, un ternaire se trompe en
 * silence (tout ce qui n'est pas « pompe » devenait du pied-de-biche).
 */
export function damageForWeapon(weapon: "melee" | "pistol" | "shotgun"): number {
  if (weapon === "shotgun") return weaponConfig.shotgunDamagePerPellet;
  if (weapon === "pistol") return weaponConfig.pistolDamage;
  return weaponConfig.meleeDamage;
}

// Variantes de recul — harnais A/B, même mécanique que `FEEL_VARIANTS` dans
// `moveConfig.ts`. Axe, usage console et protocole F9/F10 :
// see: docs/systems/armes.md#recul-du-viewmodel-recoil_variants

export interface RecoilVariant {
  meleeRecoil: RecoilKick;
  /** Le pistolet suit la même échelle que les deux autres, en plus sec. */
  pistolRecoil: RecoilKick;
  shotgunRecoil: RecoilKick;
}

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

// Variantes d'impact (hitstop + screenshake) — harnais A/B, retour playtest
// Phase 3. Axe, fait mécanique vérifié (non-cumul entre plombs) et protocole
// F9/F10 (limite de restauration des PV ennemis) :
// see: docs/systems/armes.md#hitstop-et-shake-murennemi-impact_variants

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
// see: docs/systems/armes.md#confirmation-de-hit-à-lécran-hitmarker_variants

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

// Variantes de réticule — harnais A/B. `crosshairEnabled` reste VRAI dans
// les trois (demande explicite, pas un axe de comparaison, voir doc du
// champ ci-dessus) ; seul le style varie. Usage, protocole F9/F10 :
// see: docs/systems/armes.md#réticule-permanent-crosshair_variants

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
