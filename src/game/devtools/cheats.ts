/**
 * Bascules de dev qui changent le GAMEPLAY — à distinguer des outils qui ne
 * changent que l'affichage (wireframe `KeyV`, gizmos `KeyB`). Une seule pour
 * l'instant : `notarget`, empruntée à Doom/Quake — les ennemis cessent de voir
 * le joueur, ce qui permet de parcourir un niveau pour le regarder.
 *
 * Module FEUILLE, sans aucun import : lu depuis `entities/enemyMachine.ts` au
 * pas fixe, écrit depuis l'UI et la console (`cassandre.notarget()`), jamais
 * l'inverse.
 *
 * Conséquence à connaître : un rejeu d'input (F9/F10) enregistré avec
 * `notarget` actif ne rejoue pas la même partie s'il est relu sans — la
 * continuité du RNG est intacte (invariant #12), mais les ennemis, eux, ne
 * prennent plus les mêmes décisions.
 * see: docs/reference/controles.md#touches-de-dev
 */
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
