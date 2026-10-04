import { suitConfig, type SuitConfig } from "../suit/suitConfig";

// Le Rampant : reptilien sans costume. Rapide, fragile, au corps-à-corps, en
// meute — il force à reculer et à viser bas. Même machine d'état que le
// Costard (`shared/enemyMachine.ts`), une autre configuration.
// Valeurs de départ, à régler en playtest (lot B7 de PLAN_SUITE.md).
export const rampantConfig: SuitConfig = {
  ...suitConfig,

  // Deux balles de pistolet, un coup de pied-de-biche.
  maxHp: 20,

  // Capsule de 1,2 m : la tête d'un Costard est à 1,7 m, la sienne sous la
  // ceinture. Un tir à hauteur d'homme passe au-dessus.
  capsuleRadius: 0.35,
  capsuleHalfHeight: 0.25,
  eyeHeight: 0.8,
  characterMass: 45,

  sightRange: 26,
  lostContactTimeout: 6,

  // Plus vite que la marche du joueur (9 m/s), moins que sa course (13) : on
  // ne le sème qu'en sprintant, et pas en reculant.
  chaseSpeed: 9.5,
  turnRateRadPerSec: 12,

  alertDuration: 0.3,
  // L'élan avant le coup de griffe : le temps de reculer d'un pas.
  attackTelegraphDuration: 0.28,
  attackCooldown: 1.1,
  // Distance à laquelle il prend son élan ; le coup ne porte qu'à `melee.reach`.
  attackRange: 2.6,
  staggerDuration: 0.3,

  // Une meute de quatre sur un joueur immobile : ~17 PV par seconde. Il faut bouger, pas mourir en trois secondes.
  attackDamage: 6,
  aimJitterDeg: 0,
  gibDistance: 3,

  melee: {
    reach: 1.9,
    lungeSpeed: 7,
  },
};
