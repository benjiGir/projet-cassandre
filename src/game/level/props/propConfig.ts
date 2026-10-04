export const DEFAULT_PROP_MASS_KG = 25;

/** Frottement/rebond d'un prop : il glisse un peu et ne rebondit pas. Un
 * caddie qui rebondit se lit comme un ballon de plage. */
export const PROP_FRICTION = 0.8;

export const PROP_RESTITUTION = 0;

/** Amortissements : sans eux, un prop poussé sur un sol plat garde sa vitesse
 * très longtemps (Rapier n'a pas de frottement de roulement) et traverse la
 * pièce pour un coup d'épaule. */
export const PROP_LINEAR_DAMPING = 0.6;

export const PROP_ANGULAR_DAMPING = 0.8;

// see: PLAN_SUITE.md, lot B3 — valeurs de départ, que le lot B7 règle.
export interface ExplosionConfig {
  /** Rayon du souffle, en mètres. Au-delà, rien n'est touché. */
  radius: number;
  /** Dégâts au centre ; ils décroissent linéairement jusqu'à 0 au bord du rayon. */
  damage: number;
  /** Part de ces dégâts que le joueur encaisse : il est puni, pas exécuté. */
  playerDamageScale: number;
  /** Distance sous laquelle un Costard tué par le souffle part en morceaux, en mètres. */
  gibDistance: number;
  /** Impulsion donnée à un prop au centre, en N·s ; même décroissance que les dégâts. */
  impulse: number;
  /** Part de l'impulsion envoyée vers le haut : un prop soufflé décolle au lieu de racler le sol. */
  impulseLift: number;
  /** Pas fixes entre un souffle et l'explosion d'une bonbonne qu'il atteint. */
  chainDelaySteps: number;
}

export const explosionConfig: ExplosionConfig = {
  radius: 5,
  damage: 120,
  playerDamageScale: 0.5,
  gibDistance: 2.5,
  impulse: 600,
  impulseLift: 0.5,
  // 9 pas = 0,15 s : assez pour LIRE la chaîne, pas assez pour s'en échapper.
  chainDelaySteps: 9,
};

/** Dégâts du souffle à `distance` mètres de son centre. */
export function blastDamageAt(distance: number, cfg: ExplosionConfig = explosionConfig): number {
  if (distance >= cfg.radius) return 0;
  return cfg.damage * (1 - Math.max(0, distance) / cfg.radius);
}
