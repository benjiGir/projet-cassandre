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
  // ------------------------------------------------------------- pied-de-biche
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

  // ------------------------------------------------------------------- pompe
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

  // ------------------------------------------------------------------- recul
  /** Kick de recul du pied-de-biche à la frappe. Récupéré par rampe linéaire (`approach()`), au dt de gameplay. */
  meleeRecoil: RecoilKick;
  /** Kick de recul du pompe au tir. Même mécanique que `meleeRecoil`. */
  shotgunRecoil: RecoilKick;

  // ----------------------------------------------------------------- hitstop
  /**
   * Durée du gel d'impact, en secondes. Le plan prescrit 3 frames à 60 Hz =
   * exactement `3 * FIXED_DT`. Dérivée de `DEFAULT_HITSTOP_FRAMES` plus bas
   * pour ne jamais coder `0.05` en dur ; reste un champ TUNABLE à chaud —
   * changer `hitstopDuration` directement (en secondes) est la façon
   * normale de le retuner, `DEFAULT_HITSTOP_FRAMES` ne sert qu'à documenter
   * l'origine de la valeur de départ.
   */
  hitstopDuration: number;
  /**
   * Échelle appliquée au dt de gameplay pendant le hitstop (0 = pas fixe
   * figé, 1 = pas de ralenti). Le plan ne prescrit aucune valeur ; reprend
   * le défaut de `GameClock.triggerHitstop` (0.05) SANS le trancher — champ
   * exposé pour l'arbitrage humain.
   */
  hitstopScale: number;

  // -------------------------------------------------------------- screenshake
  // Déclenchement uniquement : l'implémentation du shake (lecture de ces
  // constantes, forme de décroissance) appartient à `retro-render`, pas à
  // cette couche. Les trois valeurs sont PRESCRITES par le plan — exposées
  // ici comme config plutôt qu'en dur dans le futur code de rendu, mais pas
  // à retuner sans relire le plan.
  /** Amplitude du screenshake, en mètres (ou unité équivalente choisie par `retro-render`). PRESCRIT. */
  shakeAmplitude: number;
  /** Durée du screenshake, en secondes. PRESCRIT (120 ms). */
  shakeDuration: number;
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
  shotgunRecoil: { kickX: 0, kickY: 0.025, kickZ: 0.14, kickPitchDeg: 7, recoverTime: 0.22 },

  hitstopDuration: DEFAULT_HITSTOP_FRAMES * FIXED_DT,
  hitstopScale: 0.05,

  shakeAmplitude: 0.15,
  shakeDuration: 0.12,
};

// --------------------------------------------------------------------------
// Variantes de recul — harnais A/B, même mécanique que `FEEL_VARIANTS` dans
// `moveConfig.ts`.
//
// Un seul axe : « combien le tir bouscule la vue ». A privilégie le suivi de
// cible (peu de kick, récupération rapide) ; C privilégie la sensation
// d'impact au prix du temps de réacquisition de la visée. Aucune variante ne
// touche aux dégâts, à la cadence ou aux munitions — ce sont des leviers de
// GAMEPLAY, pas de FEEL, et ils ne sont pas dans le scope de cet A/B.
//
// Usage (console) :
//     cassandre.applyRecoilVariant("A");
// Comparable au pas fixe près via le même harnais F9 (enregistrer) / F10
// (rejouer) que le déplacement : `InputFrame.fire` est enregistré comme
// n'importe quel autre front, donc rejouer une séquence de tir donne un
// recul identique à variante fixée.
// --------------------------------------------------------------------------

export interface RecoilVariant {
  meleeRecoil: RecoilKick;
  shotgunRecoil: RecoilKick;
}

export const RECOIL_VARIANTS: Record<"A" | "B" | "C", RecoilVariant> = {
  /**
   * A — DISCIPLINÉ. Kick court, récupération rapide : on garde la cible en
   * joue entre deux tirs. Risque assumé : peut se sentir mou, presque sans
   * conséquence de tirer.
   */
  A: {
    meleeRecoil: { kickX: 0, kickY: -0.015, kickZ: 0.02, kickPitchDeg: 2, recoverTime: 0.1 },
    shotgunRecoil: { kickX: 0, kickY: 0.012, kickZ: 0.07, kickPitchDeg: 3, recoverTime: 0.14 },
  },

  /**
   * B — CLASSIQUE. Un kick net qui se sent mais ne fait pas perdre la cible
   * plus d'un instant. Point de départ recommandé.
   */
  B: {
    meleeRecoil: { kickX: 0, kickY: -0.035, kickZ: 0.05, kickPitchDeg: 5, recoverTime: 0.18 },
    shotgunRecoil: { kickX: 0, kickY: 0.025, kickZ: 0.14, kickPitchDeg: 7, recoverTime: 0.22 },
  },

  /**
   * C — LOURD. Le pompe repousse visiblement la vue, le pied-de-biche a du
   * poids. Risque assumé : retarder le tir suivant ou la réacquisition
   * visuelle, en particulier gênant sur plusieurs cibles rapprochées (à
   * évaluer seulement quand des ennemis existeront, Phase 3).
   */
  C: {
    meleeRecoil: { kickX: 0, kickY: -0.06, kickZ: 0.09, kickPitchDeg: 9, recoverTime: 0.28 },
    shotgunRecoil: { kickX: 0, kickY: 0.045, kickZ: 0.22, kickPitchDeg: 12, recoverTime: 0.32 },
  },
};
