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
