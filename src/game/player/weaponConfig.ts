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
   * Durée du gel d'impact GÉNÉRIQUE (n'importe quel collider touché — mur,
   * boîte de la gym, matière indifférenciée), en secondes. Le plan prescrit
   * 3 frames à 60 Hz = exactement `3 * FIXED_DT`. Dérivée de
   * `DEFAULT_HITSTOP_FRAMES` plus bas pour ne jamais coder `0.05` en dur ;
   * reste un champ TUNABLE à chaud — changer `hitstopDuration` directement
   * (en secondes) est la façon normale de le retuner, `DEFAULT_HITSTOP_FRAMES`
   * ne sert qu'à documenter l'origine de la valeur de départ.
   *
   * DISTINCTION MUR/ENNEMI (retour playtest Phase 3 — « le feedback est
   * mauvais sur un hit ») : `weapons.ts` sélectionne CE champ quand le
   * collider touché n'appartient PAS à `GROUP.ENEMY` (voir
   * `materialForCollider`) ; `enemyHitstopDuration` ci-dessous est utilisé à
   * la place pour un vrai hit ennemi. Avant cette distinction, un plomb
   * touchant un mur et un plomb touchant un Costard déclenchaient EXACTEMENT
   * le même hitstop — aucun signal renforcé pour « tu as touché la cible ».
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

  // -------------------------------------------------------------- screenshake
  // Déclenchement uniquement : l'implémentation du shake (lecture de ces
  // constantes, forme de décroissance) appartient à `retro-render`, pas à
  // cette couche. `shakeAmplitude`/`shakeDuration` (mur/générique) sont
  // PRESCRITS par le plan — exposées ici comme config plutôt qu'en dur dans
  // le futur code de rendu, mais pas à retuner sans relire le plan. Les deux
  // champs `enemy*` ci-dessous ne sont PAS prescrits : ce sont des candidats
  // de variante ouverts à l'arbitrage humain, même distinction mur/ennemi que
  // le hitstop ci-dessus.
  /** Amplitude du screenshake GÉNÉRIQUE, en mètres (ou unité équivalente choisie par `retro-render`). PRESCRIT. */
  shakeAmplitude: number;
  /** Durée du screenshake GÉNÉRIQUE, en secondes. PRESCRIT (120 ms). */
  shakeDuration: number;
  /** Amplitude du screenshake sur un hit ENEMY confirmé. Valeur de départ = IDENTIQUE à `shakeAmplitude`. */
  enemyShakeAmplitude: number;
  /** Durée du screenshake sur un hit ENEMY confirmé. Valeur de départ = IDENTIQUE à `shakeDuration`. */
  enemyShakeDuration: number;

  // -------------------------------------------------------------- hitmarker
  // Nouveau canal de feedback (angle mort identifié en playtest Phase 3,
  // ABSENT du jeu jusqu'ici) : confirmation de hit à l'écran, indépendante de
  // la lisibilité du sprite touché — utile à 640×360 où un flash émissif sur
  // un petit sprite peut se noyer en plein combat. Implémentation dans
  // `render/hitmarker.ts` (overlay canvas 2D temps réel, hors React —
  // invariant #2, une confirmation de hit doit apparaître en un frame et
  // durer ~100-150 ms, largement sous le throttle 10 Hz du HUD React).
  //
  // `hitmarkerEnabled` DÉSACTIVÉ PAR DÉFAUT, volontairement : c'est un
  // système entièrement NOUVEAU, pas un retuning d'un système existant — le
  // livrer actif changerait le feedback par défaut sans validation humaine.
  // Activer via `cassandre.weaponConfig.hitmarkerEnabled = true`, un bouton
  // `HITMARKER_VARIANTS` du panneau de tuning, ou `applyHitmarkerVariant`.
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

  // ------------------------------------------------------------- crosshair
  // Retour playtest (son ajouté juste avant) : « le tir est assez hasardeux
  // ... j'ai l'impression de ne pas toucher à bout portant ». Diagnostic :
  // AUCUN réticule permanent n'existait — le seul repère visuel de visée
  // était le viewmodel (décalé bas-droit de l'écran, PAS le centre), le
  // hitmarker ne confirmant qu'un HIT après coup. Contrairement au
  // hitmarker (Phase 3, système nouveau livré désactivé par défaut faute de
  // demande explicite), le réticule est une demande EXPLICITE de
  // l'utilisateur — `crosshairEnabled` est donc ACTIVÉ par défaut, exécution
  // directe de la demande plutôt qu'un choix de feel autonome.
  //
  // CORRECTITUDE, pas une variante : le réticule est dessiné au CENTRE EXACT
  // du canvas interne (`render/crosshair.ts`, résolution 640×360, invariant
  // #4) — la caméra utilise une projection perspective SYMÉTRIQUE (aucun
  // `setViewOffset`/décalage de point principal nulle part dans le projet) à
  // ce même ratio d'aspect, et `WeaponSystem.computeAimBasis` dérive
  // `aimForward` de `yaw`/`pitch` avec EXACTEMENT la même convention Euler
  // 'YXZ' que `camera.quaternion` dans `main.ts` — le centre du canvas EST
  // donc, par construction géométrique, le point vers lequel pointe
  // `aimForward`. Aucune marge de tuning sur la POSITION. Seul le STYLE
  // (croix/point, taille, épaisseur, couleur, pulsation au tir) est un axe
  // de variante — voir `CROSSHAIR_VARIANTS`.
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

// --------------------------------------------------------------------------
// Variantes d'impact (hitstop + screenshake) — harnais A/B, retour playtest
// Phase 3 : « la sensation de tir et de touché n'est pas bonne ». Angle
// identifié en lecture de code, PAS encore validé humainement : le hitstop et
// le screenshake étaient jusqu'ici DÉCLENCHÉS IDENTIQUES qu'un plomb touche un
// mur ou un Costard — aucun signal renforcé spécifique à « j'ai touché
// l'ennemi ». Un seul axe ici : « à quel point le hit ENNEMI se démarque du
// hit générique (mur) ». Ne touche à AUCUNE valeur de dégât/cadence/munitions
// (leviers de GAMEPLAY hors scope, même discipline que `RECOIL_VARIANTS`).
//
// FAIT MÉCANIQUE VÉRIFIÉ (`GameClock.triggerHitstop`, `FxSystem.triggerShake`) :
// les deux DÉCLENCHEMENTS NE SOMMENT JAMAIS entre plusieurs plombs du même tir
// de pompe dans le même pas fixe — `triggerHitstop` écrase simplement
// `hitstopRemaining`/`hitstopScale` (dernier appel gagne, valeurs identiques
// d'un plomb à l'autre pour un même tir donc aucune différence observable) et
// `triggerShake` prend le MAX de l'amplitude courante et de la nouvelle, en
// relançant la durée pleine. Un tir de pompe à 9 plombs sur un Costard ne
// « sur-déclenche » donc PAS 9× plus fort qu'un plomb — mais il ne se
// distingue pas non plus d'un seul plomb sur un mur. Le vrai problème signalé
// par le playtest n'est pas un empilement cassé, c'est l'ABSENCE de
// distinction mur/ennemi — ce que cet A/B corrige.
//
// Usage (console) :
//     cassandre.applyImpactVariant("A");
// Protocole F9/F10 : comme `applyRecoilVariant`, mais vise un Costard (les 3
// spawns du hub sont déterministes) — l'IA/l'état des Costards tournent
// entièrement au pas fixe avec PRNG seedé, donc un rejeu vise et touche
// exactement la même cible. LIMITE connue : F9/F10 ne restaure QUE l'état du
// JOUEUR au début de l'enregistrement, pas les PV/positions des Costards —
// pour comparer les variantes sur un hit ennemi propre, commencer
// l'enregistrement avant le premier coup porté à un Costard donné (PV pleins),
// ou respawner une cible fraîche via `cassandre.spawnSuit(x, y, z)` avant
// chaque F10 si le Costard visé est déjà mort/en stagger d'un essai précédent.
// --------------------------------------------------------------------------

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
  /**
   * A — UNIFORME (comportement actuel, avant cette intervention). Le hit
   * ennemi et le hit mur déclenchent EXACTEMENT le même hitstop/shake.
   * Repère de contrôle pour l'A/B, pas une proposition.
   */
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

  /**
   * B — SIGNAL RENFORCÉ. Hit mur inchangé ; hit ennemi confirmé avec un
   * hitstop ~60 % plus long et un shake ~50 % plus ample. Hypothèse : la
   * plainte « feedback mauvais sur un hit » vient en partie de l'absence de
   * différence perceptible entre toucher le décor et toucher la cible.
   */
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

  /**
   * C — PUNCHY EXTRÊME. Hit ennemi très marqué (hitstop quasi doublé, shake
   * ×2). Risque assumé : peut devenir désorientant/nauséeux sur plusieurs
   * Costards rapprochés qui tirent tous, ou casser le rythme du pompe en
   * rafale — à évaluer explicitement en combat à 2-3 Costards, pas seulement
   * au mur vide.
   */
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

// --------------------------------------------------------------------------
// Variantes de hitmarker — harnais A/B pour un canal de feedback ABSENT du
// jeu jusqu'ici (angle mort identifié en playtest, aucun hitmarker/crosshair
// n'existait dans `src/ui/`). Axe : « combien le marqueur affirme le hit,
// indépendamment du sprite touché ». `OFF` reste la valeur de départ
// effective (`weaponConfig.hitmarkerEnabled = false`) — voir sa doc.
//
// Usage (console) :
//     cassandre.applyHitmarkerVariant("SOBRE");
// --------------------------------------------------------------------------

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

  /**
   * SOBRE — petite croix blanche discrète sur un hit, légèrement plus grande
   * et rouge sur un kill. Confirmation minimale, ne devrait pas distraire de
   * la visée.
   */
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

  /**
   * ARCADE — marqueur plus grand, plus épais, tenu plus longtemps,
   * particulièrement marqué sur un kill. Risque assumé : peut se sentir
   * criard/« jeu mobile » et distraire du sprite touché lui-même.
   */
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

// --------------------------------------------------------------------------
// Variantes de réticule — harnais A/B, retour playtest (son) : « le tir est
// assez hasardeux ... j'ai l'impression de ne pas toucher à bout portant ».
// Contrairement à `HITMARKER_VARIANTS`, `crosshairEnabled` reste VRAI dans
// les trois variantes : la présence d'un réticule est la demande explicite
// elle-même (voir la doc du champ ci-dessus), pas un axe de comparaison. Un
// seul axe ici : « quel repère de visée, et bouge-t-il ». Ne touche à AUCUNE
// valeur de portée/dégâts/dispersion (leviers de GAMEPLAY hors scope, même
// discipline que `RECOIL_VARIANTS`/`IMPACT_VARIANTS`).
//
// Usage (console) :
//     cassandre.applyCrosshairVariant("POINT");
// Protocole F9/F10 : comme les autres harnais de ce fichier — le rendu du
// réticule ne dépend d'aucun état de simulation (position/visée lues au
// taux d'affichage dans `interpolateVisuals`), donc même un rejeu de
// mouvement SANS tir suffit à comparer la lisibilité du repère au centre de
// l'écran pendant qu'on court/saute — pas besoin de viser une cible.
// --------------------------------------------------------------------------

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
  /**
   * CROIX_STATIQUE — croix fine, verte, immobile. Repère de visée constant
   * façon Quake/Half-Life 1, aucune animation ajoutée. Point de départ
   * recommandé (= valeurs par défaut de `weaponConfig`).
   */
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

  /**
   * POINT — point unique blanc, minimal, façon Build engine (Ion Fury).
   * Masque moins la cible qu'une croix ; risque assumé : moins visible sur
   * fond clair ou texturé une fois les assets finaux en place (Phase 5).
   */
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

  /**
   * CROIX_RESPIRATION — croix + léger sursaut d'échelle à CHAQUE tir
   * déclenché (pas seulement un hit) : confirmation supplémentaire que le
   * coup est parti, au centre exact de l'écran. Risque assumé : ajoute du
   * mouvement pile là où l'œil doit rester stable pour viser — peut gêner la
   * visée fine, en particulier en rafale de pompe (cooldown 0.8 s, largement
   * au-dessus de `crosshairPulseDuration`, donc pas de chevauchement de
   * pulsations à tester séparément).
   */
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
