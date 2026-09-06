/**
 * Paramètres de l'ennemi « Costard » — source unique de vérité, même
 * convention que `game/player/moveConfig.ts`/`weaponConfig.ts` : objet
 * mutable, tunable à chaud (`cassandre.suitConfig.xxx = …`), aucun nombre de
 * comportement/combat codé en dur ailleurs que dans ce fichier. Valeurs de
 * départ, pas des choix de tuning arrêtés, sauf mention contraire explicite
 * ci-dessous.
 * see: docs/reference/valeurs-ennemis.md
 */
export interface SuitConfig {
  /** Points de vie max, en PV. */
  maxHp: number;

  // Mêmes conventions capsule/KCC que `MoveConfig` (skill
  // `rapier-character-controller`), dupliquées ici plutôt que réutilisées :
  // `MoveConfig` porte aussi visée, saut, head bob — sans sens pour un
  // Costard — et le coupler romprait dès que l'un des deux bouge pour une
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
   * MÊME raison que `MoveConfig.groundStickSpeed` (voir sa doc détaillée
   * dans `moveConfig.ts` : au-delà d'~0.2 combiné à un grand déplacement
   * horizontal axé-axe, `computeColliderMovement` dégénère). Les ennemis se
   * déplacent plus lentement que le joueur, donc le risque mesuré côté
   * joueur est déjà une borne haute ici.
   */
  groundStickSpeed: number;
  maxFallSpeed: number;

  /** Distance de détection du joueur, en mètres. Au-delà, IDLE ne vérifie même pas la ligne de vue. */
  sightRange: number;
  /**
   * Temps sans contact visuel avant de retomber en IDLE, en secondes.
   * Valeur PRESCRITE par le skill `enemy-state-machine` (diagramme de la
   * machine à états) — ne pas la retuner sans relire le skill.
   */
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

  /** Dégâts infligés au joueur par attaque réussie. */
  attackDamage: number;
  /** Jitter de visée du raycast d'attaque, en degrés (demi-étendue). PRNG seedé par entité — jamais `Math.random()`. */
  aimJitterDeg: number;
  /** Distance en dessous de laquelle un coup de pompe mortel déclenche des gibs, en mètres — point de tuning ouvert (contrairement aux valeurs de dispersion du pompe, prescrites dans `weaponConfig.ts`). */
  gibDistance: number;

  // Le Costard est un corps KINÉMATIQUE : `RAPIER.RigidBody.applyImpulse`
  // n'a AUCUN EFFET dessus. Le recul est donc une VÉLOCITÉ pilotée à la
  // main par `Suit`, décroissante sur `knockbackDecayTime` — voir
  // `Suit.applyDamage`/`Suit.updateKnockback`.
  /** Vitesse horizontale initiale du recul à l'impact, m/s. */
  knockbackSpeed: number;
  /** Temps de retour à zéro du recul DEPUIS cette vitesse, en secondes (rampe linéaire, même idiome que `approach()` dans `controller.ts`). */
  knockbackDecayTime: number;
  /** Composante verticale initiale du recul (petit « pop » vers le haut), m/s. */
  knockbackUpBoost: number;

  /**
   * Durée du flash blanc de dégât sur le sprite touché, en secondes. Était
   * une constante en dur (`FLASH_DURATION`) dans `render/billboard.ts`, non
   * exposée — violait le mandat « config unique, tunable à chaud » du skill
   * `game-feel-tuning`. Déplacée ici, valeur de départ inchangée.
   */
  hitFlashDuration: number;

  /** Amplitude du screenshake quand une attaque de Costard touche le joueur, en mètres (via l'API publique existante de `render/fx.ts::triggerShake`). */
  playerHitShakeAmplitude: number;
  /** Durée de ce screenshake, en secondes. */
  playerHitShakeDuration: number;
}

export const suitConfig: SuitConfig = {
  // 50 : calé pour qu'un tir de pompe totalement à bout portant (9 plombs)
  // tue de façon fiable en un coup — condition nécessaire à la mécanique de
  // gibs. see: docs/reference/valeurs-ennemis.md#vie
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

/**
 * Variantes de knockback — harnais A/B (`cassandre.applyKnockbackVariant("B")`).
 * `knockbackSpeed`/`knockbackDecayTime`/`knockbackUpBoost` n'avaient jamais
 * été tunés humainement ; candidats identifiés par le retour playtest
 * Phase 3. Protocole F9/F10 : le recorder ne restaure pas l'état des
 * Costards, voir la doc du harnais.
 * see: docs/reference/valeurs-ennemis.md#variantes-de-knockback-costard-harnais-ab
 */
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

/**
 * Variantes de flash de dégât — harnais A/B (`cassandre.applyFlashVariant("B")`).
 * see: docs/reference/valeurs-ennemis.md#variantes-de-flash-costard-harnais-ab
 */
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
