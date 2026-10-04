import { suitConfig, type SuitConfig } from "../suit/suitConfig";

// Le Vigile : lourd, lent, protégé de face par un bouclier. Il force à le
// contourner ou à utiliser un explosif. Même machine d'état que le Costard
// (`shared/enemyMachine.ts`), une autre configuration.
// Valeurs de départ, à régler en playtest (lot B7 de PLAN_SUITE.md).
export const vigileConfig: SuitConfig = {
  ...suitConfig,

  // Trois coups de pompe dans le dos, ou une bonbonne à ses pieds.
  maxHp: 140,

  // Capsule de 2 m, plus large que celle d'un Costard : une armoire.
  capsuleRadius: 0.5,
  capsuleHalfHeight: 0.5,
  eyeHeight: 1.75,
  characterMass: 130,

  sightRange: 20,
  lostContactTimeout: 8,

  // Moins vite qu'un joueur qui marche à reculons, et il tourne lentement :
  // à 3 m, un joueur qui lui tourne autour (9 m/s, soit 3 rad/s) passe dans son dos.
  chaseSpeed: 2.6,
  turnRateRadPerSec: 2.2,

  alertDuration: 0.6,
  // Le temps de lever la matraque : large, lisible, esquivable d'un pas en arrière.
  attackTelegraphDuration: 0.55,
  attackCooldown: 1.8,
  // Distance à laquelle il arme son coup ; il ne porte qu'à `melee.reach`.
  attackRange: 2.8,
  staggerDuration: 0.35,

  attackDamage: 22,
  aimJitterDeg: 0,

  // Trop lourd pour reculer comme un Costard.
  knockbackSpeed: 1.2,
  knockbackUpBoost: 0.3,

  melee: {
    reach: 2.3,
    lungeSpeed: 3.5,
  },

  shield: {
    halfArcDeg: 70,
  },
};
