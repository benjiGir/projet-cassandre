// see: docs/archive/reference-controles.md#touches-de-dev
export interface Cheats {
  /** Les ennemis ne voient plus le joueur, et leurs attaques ne font rien. */
  notarget: boolean;
}

export const cheats: Cheats = { notarget: false };

/** Pose la valeur et la retourne — `setNotarget()` sans argument active. */
export function setNotarget(on = true): boolean {
  cheats.notarget = on;
  return cheats.notarget;
}

/** Bascule et retourne le nouvel état (touche F8, panneau de tuning). */
export function toggleNotarget(): boolean {
  return setNotarget(!cheats.notarget);
}
