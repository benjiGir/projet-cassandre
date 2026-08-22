/**
 * Paramètres du « Directeur » — boss unique de fin (Zone E, plan
 * `PLAN_PROTO_BOOMER_SHOOTER.md` : « Le directeur. Sa peau se déchire quand
 * tu tires : reptilien. Le badge tombe. »). MÊME convention que
 * `suitConfig.ts` : objet mutable, tunable à chaud
 * (`cassandre.directorConfig.xxx = …` une fois câblé), source unique de
 * vérité pour ce type d'ennemi — aucun nombre de comportement/combat codé en
 * dur ailleurs que dans ce fichier.
 *
 * DUPLIQUE délibérément la FORME de `SuitConfig` plutôt que de la réutiliser
 * ou de l'étendre (invariant #8 : pas d'ECS/abstraction partagée avant 12
 * types d'ennemis — le Directeur est le 2ᵉ type du jeu). Un second type
 * d'ennemi qui hérite du premier romprait dès que l'un des deux bouge pour
 * une raison propre à lui seul — exactement le risque déjà documenté dans
 * `suitConfig.ts` au sujet de `MoveConfig`/`SuitConfig`.
 *
 * TOUTES les valeurs ci-dessous sont des POINTS DE DÉPART arbitraires (même
 * discipline que `suitConfig.ts`), pas des choix de tuning arrêtés — sauf
 * mention contraire explicite (`attackTelegraphDuration`, plancher non
 * négociable du skill `enemy-state-machine`). L'arbitrage fin appartient à un
 * futur passage `feel-tuner`, une fois le Directeur câblé et testable en jeu.
 */
export interface DirectorConfig {
  // -------------------------------------------------------------------- vie
  /**
   * Points de vie max. 300 = 6× `suitConfig.maxHp` (50) : un boss UNIQUE doit
   * survivre nettement plus qu'un Costard (qui meurt en un coup de pompe à
   * bout portant) sans pour autant transformer le combat en corvée — à titre
   * de repère, ça correspond à environ 6 tirs de pompe pleinement chargés à
   * bout portant (9 plombs × `weaponConfig.shotgunDamagePerPellet`) ou une
   * trentaine de coups de pied-de-biche. Point de départ arbitraire, comme le
   * reste de ce fichier.
   */
  maxHp: number;
  /**
   * Fraction de `maxHp` EN DESSOUS DE LAQUELLE la révélation se déclenche
   * (costume humain -> reptilien), dans `(0, 1]`. Exprimée en FRACTION plutôt
   * qu'en PV absolus pour rester correcte si `maxHp` est retuné plus tard
   * sans qu'il faille recalculer ce seuil séparément (même risque de valeurs
   * couplées que documente `SuitConfig.gibDistance`).
   *
   * 0.5 CHOISI (pas prescrit par la tâche) : trope de « seconde phase » de
   * boss standard — signal de progression clair à MI-combat, pas seulement
   * au moment de la mort. Plus haut (ex. 0.8) rendrait la révélation quasi
   * immédiate (perd son effet de surprise) ; plus bas (ex. 0.2) la ferait
   * arriver trop tard pour influencer la fin du combat.
   */
  revealHpFraction: number;

  // ------------------------------------------------- capsule / KinematicCharacterController
  // Mêmes conventions que `SuitConfig` (elle-même calquée sur `MoveConfig`),
  // dupliquées ici pour la même raison qu'elle : voir sa doc de tête.
  /** Légèrement plus grande que celle du Costard (0.4) : silhouette de boss plus imposante. */
  capsuleRadius: number;
  /** Légèrement plus grande que celle du Costard (0.5), même raison. */
  capsuleHalfHeight: number;
  /** Hauteur des yeux depuis les pieds, en mètres — cohérente avec une capsule plus haute que celle du Costard. */
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

  // ------------------------------------------------------------- perception
  /** Distance de détection du joueur, en mètres. La salle de Zone E fait 16×16 m : cette valeur (identique au Costard) couvre déjà toute la pièce. */
  sightRange: number;
  /** Temps sans contact visuel avant de retomber en IDLE, en secondes. Même valeur PRESCRITE par le skill `enemy-state-machine` que pour le Costard. */
  lostContactTimeout: number;

  // ------------------------------------------------------------ déplacement
  /** Vitesse de poursuite, m/s. Légèrement < celle du Costard (3.6) : un boss avance plus lourdement, délibérément — pas un choix de difficulté. */
  chaseSpeed: number;
  /** Vitesse de rotation du `forward` visuel/de visée, rad/s. Plus lente que le Costard (8) : un boss tourne plus lourdement, cohérent avec sa carrure. */
  turnRateRadPerSec: number;

  // ------------------------------------------------------- évitement (skill enemy-state-machine)
  /** Longueur des 3 rayons d'évitement, en mètres — un peu plus longue que le Costard (1.4), cohérente avec une capsule plus large. */
  avoidanceRayLength: number;
  /** Demi-angle des rayons latéraux d'évitement, en degrés. PRESCRIT par le skill (30°), identique au Costard. */
  avoidanceSideAngleDeg: number;

  // ------------------------------------------------- machine à états — durées
  /** Temps passé en ALERTE avant de basculer en POURSUITE, en secondes. */
  alertDuration: number;
  /**
   * Temps d'anticipation de l'attaque (pose TIR tenue) avant que les dégâts
   * ne partent, en secondes. PLANCHER NON NÉGOCIABLE du skill : >= 0.2 s.
   * Valeur choisie ICI légèrement AU-DESSUS de celle du Costard (0.35 s) :
   * un boss doit se lire comme plus lourd/plus lisible qu'un Costard, jamais
   * plus rapide à réagir — ne jamais descendre sous 0.2 s en tuning.
   */
  attackTelegraphDuration: number;
  /** Temps minimum entre deux attaques, en secondes. */
  attackCooldown: number;
  /** Distance max à laquelle une attaque peut être déclenchée, en mètres. */
  attackRange: number;
  /** Durée de l'état RECUL (stagger après avoir encaissé un coup), en secondes. */
  staggerDuration: number;
  /** Durée d'UNE frame de l'animation de mort, en secondes. Durée totale = `deathFrameCount` × cette valeur (voir `DIRECTOR_DEATH_FRAME_COUNT` dans `director.ts`). */
  deathFrameDuration: number;

  // ---------------------------------------------------------------- combat
  /** Dégâts infligés au joueur par attaque réussie. Plus haut que le Costard (10) : un boss doit faire plus mal, mais rester survivable plusieurs coups avec `playerMaxHp` (100, `game/state.ts`). */
  attackDamage: number;
  /** Jitter de visée du raycast d'attaque, en degrés (demi-étendue). PRNG seedé par entité — jamais `Math.random()`. Légèrement plus précis que le Costard (2.5°) : un boss vise mieux. */
  aimJitterDeg: number;

  // ------------------------------------------------------------- knockback
  // Le Directeur est un corps KINÉMATIQUE, exactement comme le Costard :
  // `RAPIER.RigidBody.applyImpulse` n'a AUCUN EFFET dessus. Voir
  // `Director.applyDamage`/`Director.updateKnockback` pour le mécanisme.
  /** Vitesse horizontale initiale du recul à l'impact, m/s. Plus faible que le Costard (4.5) : un boss doit se sentir plus lourd, moins « poussable ». */
  knockbackSpeed: number;
  /** Temps de retour à zéro du recul, en secondes. */
  knockbackDecayTime: number;
  /** Composante verticale initiale du recul, m/s. */
  knockbackUpBoost: number;

  // --------------------------------------------- flash blanc de dégât
  /** Durée du flash blanc de dégât sur le sprite touché, en secondes — même mécanisme et même valeur de départ que `SuitConfig.hitFlashDuration`. */
  hitFlashDuration: number;

  // ------------------------------------------------------------ révélation
  /**
   * Teinte (`material.color`, voir `BillboardSprite.setTint`) tant que le
   * Directeur porte encore son costume humain — blanc = atlas affiché sans
   * teinte, identique au rendu du Costard.
   */
  humanTintColor: number;
  /**
   * Teinte appliquée dès la révélation (`Director.revealed === true`).
   * PLACEHOLDER explicite (invariant #9, pas d'art final) : un vert
   * reptilien nettement distinct du blanc, suffisant pour valider que la
   * bascule se déclenche au bon seuil de PV sans attendre un sprite dédié.
   */
  revealedTintColor: number;
  /** Amplitude du screenshake au moment de la révélation, en mètres — appui visuel supplémentaire sur ce moment de mise en scène (via `fx.triggerShake`, déjà une API publique existante, aucune modification de `render/fx.ts`). */
  revealShakeAmplitude: number;
  /** Durée de ce screenshake, en secondes. */
  revealShakeDuration: number;

  // ------------------------------------------------------------------ badge
  /**
   * Rayon de ramassage du badge droppé à la mort, en mètres — même ordre de
   * grandeur que la portée `use_*` (2 m, voir `game/level/interactive.ts`),
   * mais consommé par PROXIMITÉ SEULE (pas de touche E) : voir la doc de
   * `DirectorBadge` dans `director.ts` pour la justification de cet écart
   * avec `use_crowbar`.
   */
  badgePickupRadius: number;

  // ------------------------------------------- feedback visuel d'un coup reçu par le JOUEUR
  /** Amplitude du screenshake quand une attaque du Directeur touche le joueur, en mètres — plus haute que `SuitConfig.playerHitShakeAmplitude` (0.08) : un coup de boss doit se sentir plus lourd qu'un coup de Costard. */
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

  attackDamage: 15,
  aimJitterDeg: 2,

  knockbackSpeed: 3,
  knockbackDecayTime: 0.3,
  knockbackUpBoost: 1,

  hitFlashDuration: 0.25,

  humanTintColor: 0xffffff,
  revealedTintColor: 0x33cc55,
  revealShakeAmplitude: 0.12,
  revealShakeDuration: 0.25,

  badgePickupRadius: 1.5,

  playerHitShakeAmplitude: 0.1,
  playerHitShakeDuration: 0.12,
};
