/**
 * Paramètres de l'ennemi « Costard » — SOURCE UNIQUE DE VÉRITÉ, même
 * convention que `game/player/moveConfig.ts`/`weaponConfig.ts` : objet
 * mutable, tunable à chaud (`cassandre.suitConfig.xxx = …`), aucun nombre de
 * comportement/combat codé en dur ailleurs que dans ce fichier.
 *
 * TOUTES les valeurs ci-dessous sont des POINTS DE DÉPART, pas des choix de
 * tuning arrêtés (y compris `gibDistance`, la seule à porter une contrainte
 * de config explicite dans la tâche — "bout portant", pas de valeur figée
 * prescrite). L'arbitrage appartient à un futur passage `feel-tuner`.
 */
export interface SuitConfig {
  // -------------------------------------------------------------------- vie
  /** Points de vie max. Point de départ arbitraire (comme `playerMaxHp` dans `game/state.ts`). */
  maxHp: number;

  // ------------------------------------------------- capsule / KinematicCharacterController
  // Mêmes conventions que `MoveConfig` (skill `rapier-character-controller`),
  // dupliquées ici plutôt que réutilisées : `MoveConfig` porte aussi visée,
  // saut, head bob — des champs qui n'ont aucun sens pour un Costard, et le
  // coupler à `MoveConfig` romprait dès que l'un des deux bouge pour une
  // raison propre au joueur.
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
  /**
   * Vitesse descendante appliquée en permanence au sol, m/s — MÊME valeur et
   * MÊME raison que `MoveConfig.groundStickSpeed` (voir sa doc détaillée dans
   * `moveConfig.ts` : au-delà d'~0.2 combiné à un grand déplacement
   * horizontal axé-axe, `computeColliderMovement` dégénère). Les Costards se
   * déplacent nettement plus lentement que le joueur (`chaseSpeed` vs
   * `runSpeed`), donc le risque mesuré pour le joueur est déjà une borne
   * haute ici — mais retester avec le même harnais headless si `chaseSpeed`
   * est un jour poussé significativement au-dessus de la vitesse de marche
   * du joueur.
   */
  groundStickSpeed: number;
  maxFallSpeed: number;

  // ------------------------------------------------------------- perception
  /** Distance de détection du joueur, en mètres. Au-delà, IDLE ne vérifie même pas la ligne de vue. */
  sightRange: number;
  /**
   * Temps sans contact visuel avant de retomber en IDLE, en secondes.
   * Valeur PRESCRITE par le skill `enemy-state-machine` (diagramme de la
   * machine à états) — ne pas la retuner sans relire le skill.
   */
  lostContactTimeout: number;

  // ------------------------------------------------------------ déplacement
  /** Vitesse de poursuite, m/s. Volontairement < vitesse de marche du joueur (9 m/s) : un Costard qui rattrape un joueur immobile mais qu'on peut semer en bougeant. */
  chaseSpeed: number;
  /** Vitesse de rotation du `forward` visuel/de visée, rad/s. Limite le flip instantané de sprite quand l'évitement change de côté. */
  turnRateRadPerSec: number;

  // ------------------------------------------------------- évitement (skill enemy-state-machine)
  /** Longueur des 3 rayons d'évitement (avant, avant-gauche 30°, avant-droit 30°), en mètres. */
  avoidanceRayLength: number;
  /** Demi-angle des rayons latéraux d'évitement, en degrés. PRESCRIT par le skill (30°). */
  avoidanceSideAngleDeg: number;

  // ------------------------------------------------- machine à états — durées
  /** Temps passé en ALERTE (pose de « je t'ai vu ») avant de basculer en POURSUITE, en secondes. */
  alertDuration: number;
  /**
   * Temps d'anticipation de l'attaque (pose TIR tenue) avant que les dégâts
   * ne partent, en secondes. Règle NON NÉGOCIABLE du skill : >= 0.2 s, sinon
   * le joueur ne peut physiquement pas réagir. Ne jamais descendre sous ce
   * seuil, même en tuning.
   */
  attackTelegraphDuration: number;
  /** Temps minimum entre deux attaques, en secondes (indépendant de l'état courant). */
  attackCooldown: number;
  /** Distance max à laquelle une attaque peut être déclenchée, en mètres. */
  attackRange: number;
  /** Durée de l'état RECUL (stagger après avoir encaissé un coup), en secondes. */
  staggerDuration: number;
  /** Durée d'UNE frame de l'animation de mort (4 frames), en secondes. Durée totale = 4 × cette valeur. */
  deathFrameDuration: number;

  // ---------------------------------------------------------------- combat
  /** Dégâts infligés au joueur par attaque réussie. */
  attackDamage: number;
  /** Jitter de visée du raycast d'attaque, en degrés (demi-étendue). PRNG seedé par entité — jamais `Math.random()`. */
  aimJitterDeg: number;
  /**
   * Distance en dessous de laquelle un coup de pompe mortel déclenche des
   * gibs au lieu de l'animation de mort normale, en mètres. POINT DE DÉPART
   * explicitement non figé par la tâche (contrairement à
   * `shotgunPelletCount`/`shotgunSpreadConeDeg` dans `weaponConfig.ts`, qui
   * sont prescrits) — c'est un choix de tuning ouvert.
   */
  gibDistance: number;

  // ------------------------------------------------------------- knockback
  // Le Costard est un corps KINÉMATIQUE : `RAPIER.RigidBody.applyImpulse`
  // n'a AUCUN EFFET dessus (l'impulsion suppose un solveur dynamique). Le
  // recul est donc une VÉLOCITÉ pilotée à la main par `Suit`, décroissante
  // sur `knockbackDecayTime` secondes, injectée dans le mouvement désiré du
  // pas fixe exactement comme le fait `PlayerController` pour sa propre
  // vélocité — voir `Suit.applyDamage`/`Suit.updateKnockback`.
  /** Vitesse horizontale initiale du recul à l'impact, m/s. */
  knockbackSpeed: number;
  /** Temps de retour à zéro du recul DEPUIS cette vitesse, en secondes (rampe linéaire, même idiome que `approach()` dans `controller.ts`). */
  knockbackDecayTime: number;
  /** Composante verticale initiale du recul (petit « pop » vers le haut), m/s. */
  knockbackUpBoost: number;

  // --------------------------------------------- flash blanc de dégât (Costard)
  /**
   * Durée du flash blanc de dégât sur le sprite touché, en secondes. Était
   * une constante en dur (`FLASH_DURATION`) dans `render/billboard.ts`,
   * NON EXPOSÉE — violait le mandat « config unique, tunable à chaud » du
   * skill `game-feel-tuning`. Déplacée ici, valeur de départ INCHANGÉE
   * (0.25 s) : ce déplacement ne doit rien changer au feedback perçu tant
   * qu'un humain n'a pas choisi une variante `FLASH_VARIANTS` différente.
   * `BillboardSprite.setFlash(amount, durationSeconds)` lit ce champ via
   * l'appelant (`main.ts`) à chaque hit — la décroissance exponentielle
   * (forme de la courbe) reste un détail interne de `billboard.ts`.
   */
  hitFlashDuration: number;

  // ------------------------------------- feedback visuel d'un coup reçu par le JOUEUR
  // Utilisé uniquement via l'API PUBLIQUE déjà livrée de `render/fx.ts`
  // (`triggerShake`) — aucune modification de `fx.ts` nécessaire pour ce
  // feedback, voir le pont dans `main.ts`.
  /** Amplitude du screenshake quand une attaque de Costard touche le joueur, en mètres. */
  playerHitShakeAmplitude: number;
  /** Durée de ce screenshake, en secondes. */
  playerHitShakeDuration: number;
}

export const suitConfig: SuitConfig = {
  // 50, pas un chiffre rond arbitraire : calé pour qu'un tir de pompe
  // TOTALEMENT à bout portant (9 plombs × `shotgunDamagePerPellet` = 54,
  // voir `weaponConfig.ts`) tue de façon fiable en un coup — condition
  // nécessaire pour que la mécanique de gibs ait une chance de se déclencher
  // en jeu normal, où la dispersion du cône fait rarement toucher les 9
  // plombs. Le pied-de-biche (40 dégâts) laisse le Costard survivant à un
  // coup, cohérent avec une arme de mêlée plus faible que le pompe.
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

  attackDamage: 10,
  aimJitterDeg: 2.5,
  gibDistance: 3,

  knockbackSpeed: 4.5,
  knockbackDecayTime: 0.3,
  knockbackUpBoost: 1.5,

  hitFlashDuration: 0.25,

  playerHitShakeAmplitude: 0.08,
  playerHitShakeDuration: 0.1,
};

// --------------------------------------------------------------------------
// Variantes de knockback — harnais A/B, même mécanique que `RECOIL_VARIANTS`/
// `IMPACT_VARIANTS` (`game/player/weaponConfig.ts`). Un seul axe : « à quel
// point un Costard touché bouge visiblement ». `knockbackSpeed`/
// `knockbackDecayTime`/`knockbackUpBoost` n'avaient jamais été tunés
// humainement (points de départ arbitraires, voir la doc de tête du fichier)
// — candidats directs identifiés par le retour playtest Phase 3.
//
// Usage (console) :
//     cassandre.applyKnockbackVariant("B");
// Protocole F9/F10 : même limite connue que `IMPACT_VARIANTS` (le recorder ne
// restaure pas l'état des Costards) — viser une cible aux PV pleins pour
// chaque comparaison, respawner via `cassandre.spawnSuit(...)` si besoin.
// --------------------------------------------------------------------------

export interface KnockbackVariant {
  knockbackSpeed: number;
  knockbackDecayTime: number;
  knockbackUpBoost: number;
}

export const KNOCKBACK_VARIANTS: Record<"A" | "B" | "C", KnockbackVariant> = {
  /** A — SUBTIL. Le Costard vacille à peine : lisible surtout à la stagger pose, pas au mouvement. Risque : peut lire comme si les coups ne « portaient » pas. */
  A: { knockbackSpeed: 2, knockbackDecayTime: 0.25, knockbackUpBoost: 0.6 },
  /** B — CLASSIQUE (valeur de départ actuelle, inchangée). Recul net mais le Costard reste globalement sur place. */
  B: { knockbackSpeed: 4.5, knockbackDecayTime: 0.3, knockbackUpBoost: 1.5 },
  /** C — ARCADE. Le Costard est visiblement repoussé/soulevé à chaque coup. Risque assumé : peut le pousser hors de portée de mêlée, ou dans un mur/une autre entité (pas de résolution de collision entre Costards). */
  C: { knockbackSpeed: 8, knockbackDecayTime: 0.35, knockbackUpBoost: 3 },
};

// --------------------------------------------------------------------------
// Variantes de flash de dégât — harnais A/B, même mécanique. Un seul axe :
// « combien de temps le sprite touché reste visiblement blanc ». Trop court
// et le flash se noie dans le framerate/l'action ; trop long et deux coups
// rapprochés fusionnent en un seul flash continu (perd le comptage visuel des
// coups portés).
//
// Usage (console) :
//     cassandre.applyFlashVariant("B");
// --------------------------------------------------------------------------

export interface FlashVariant {
  hitFlashDuration: number;
}

export const FLASH_VARIANTS: Record<"A" | "B" | "C", FlashVariant> = {
  /** A — COURT. Flash net et bref (0.12 s) : deux coups à la cadence du pompe (0.8 s) restent toujours distincts, mais un seul coup peut passer inaperçu au coin de l'œil. */
  A: { hitFlashDuration: 0.12 },
  /** B — CLASSIQUE (valeur de départ actuelle, inchangée). */
  B: { hitFlashDuration: 0.25 },
  /** C — LONG. Flash tenu (0.45 s), très lisible même en périphérie. Risque assumé : plusieurs coups rapprochés (mêlée en rafale, plusieurs Costards groupés) peuvent fusionner visuellement. */
  C: { hitFlashDuration: 0.45 },
};
