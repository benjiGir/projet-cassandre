import * as THREE from "three";

/**
 * Filet de chute : un niveau construit sans y jouer finit toujours par avoir
 * un trou, et une chute hors du monde est SANS RETOUR — rien ne rattrape le
 * joueur, aucun écran de mort ne se déclenche, la partie est simplement
 * perdue. Le jeu mémorise donc le dernier sol réellement touché et y remet le
 * joueur au-delà d'une certaine chute.
 *
 * Ce n'est pas une mécanique de jeu, c'est un garde-fou : il ne devrait
 * jamais se déclencher. Quand il se déclenche, il le dit en console avec les
 * coordonnées — c'est ainsi qu'un playtest signale un trou à
 * `tools/level_v2/audit_niveau.py`.
 * see: docs/systems/boucle-de-jeu.md#filet-de-chute
 */

/**
 * Chute sous le dernier sol touché au-delà de laquelle on remet le joueur sur
 * pied, en mètres. Plus que toute chute VOULUE du niveau v2, dont le plus
 * grand décrochement fait 6 m (réserve → parking souterrain).
 */
export const RESCUE_FALL_DEPTH = 12;

/**
 * Mémorise la position comme « dernier sol sûr » si le joueur y touche
 * réellement le sol.
 *
 * `numCollisions > 0` en plus de `isGrounded` : un joueur qu'on vient de
 * téléporter (spawn de niveau, rejeu d'input, console de debug) se déclare au
 * sol le temps d'un pas fixe, même en plein vide. Sans cette garde, le vide
 * devient lui-même le dernier sol sûr et le filet y renvoie le joueur en
 * boucle — constaté en test.
 */
export function recordSafeGround(
  safeGround: THREE.Vector3,
  position: THREE.Vector3,
  isGrounded: boolean,
  numCollisions: number,
): boolean {
  if (!isGrounded || numCollisions <= 0) return false;
  safeGround.copy(position);
  return true;
}

/**
 * Le joueur est-il tombé assez bas pour être remis sur pied ? `false` tant
 * qu'aucun sol n'a jamais été touché (`safeGround` à l'origine) : au tout
 * début d'une partie, le joueur tombe légitimement sur le sol de départ.
 */
export function shouldRescue(safeGround: THREE.Vector3, position: THREE.Vector3, isGrounded: boolean): boolean {
  if (isGrounded) return false;
  if (safeGround.lengthSq() === 0) return false;
  return safeGround.y - position.y >= RESCUE_FALL_DEPTH;
}
