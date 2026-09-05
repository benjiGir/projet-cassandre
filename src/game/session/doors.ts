import * as THREE from "three";

import { playDoorSfx } from "../../core/audio";
import { showHudMessage } from "./feedback";
import { type GameSession } from "./gameSession";
import { type GameEngine } from "./gameEngine";

/**
 * Extraction du refactor de `main.ts` (2229 lignes → modules, 2026-09-05) :
 * `unlockDoor`/`setupExitDoorTracking`/`triggerLevelComplete` déplacées
 * telles quelles, `session`/`engine` en paramètres explicites au lieu d'une
 * fermeture sur le scope de `main()`.
 */

/**
 * Déverrouille le `door_*` nommé `targetName` (glissement + collider
 * désactivé, voir la doc de `OpeningDoor` dans `gameSession.ts`) — factorisé
 * entre `onExitDoorUse` (Zone E, gardé par badge) et `onFrozenStorageUse`
 * (Zone B, sans garde) : même mécanique de porte, seule la CONDITION
 * d'appel diffère, décidée par l'appelant avant d'invoquer cette fonction.
 * Retourne `false` sans effet si `targetName` ne correspond à aucun `door_*`
 * du niveau courant (erreur de données Blender, pas un état de jeu valide).
 */
export function unlockDoor(session: GameSession, targetName: string, successMessage: string): boolean {
  const door = (session.gltfLevelSession?.current?.doors ?? []).find((d) => d.name === targetName);
  if (!door) {
    console.error(`[main] use_* référence une porte introuvable ("${targetName}").`);
    return false;
  }
  session.unlockedDoors.add(targetName);
  const t = door.body.translation();
  session.openingDoor = { body: door.body, startY: t.y, targetY: t.y - door.halfExtents.y * 2, t: 0 };
  door.collider.setEnabled(false);
  showHudMessage(successMessage);
  playDoorSfx("unlock");
  return true;
}

/**
 * Arme le suivi de franchissement pour `doorName` — voir la doc de
 * `ExitDoorTracking` dans `gameSession.ts`. Appelé UNIQUEMENT depuis
 * `onExitDoorUse` (`game/loop/updateGameplay.ts`) pour `"door_e_exit"`,
 * jamais pour `door_b_frozen` (le secret 1 n'est pas une sortie de niveau).
 */
export function setupExitDoorTracking(session: GameSession, doorName: string): void {
  const door = (session.gltfLevelSession?.current?.doors ?? []).find((d) => d.name === doorName);
  if (!door) return; // défensif : `unlockDoor` a déjà loggé une erreur si absent, rien à ajouter ici.

  // Axe LOCAL le plus fin (hors hauteur) = l'épaisseur du vantail, donc sa
  // normale — même heuristique que `buildCuboidCollider`/`buildDoor`
  // (les deux ne connaissent que des demi-étendues, jamais un "axe de
  // porte" explicite côté données Blender).
  const localThinIsX = Math.abs(door.halfExtents.x) <= Math.abs(door.halfExtents.z);
  const localAxis = localThinIsX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const r = door.body.rotation();
  const crossingAxis = localAxis.applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).normalize();

  const t = door.body.translation();
  const doorPosition = new THREE.Vector3(t.x, t.y, t.z);
  const playerOffset = new THREE.Vector3().subVectors(session.player.position, doorPosition);
  const insideSign: 1 | -1 = playerOffset.dot(crossingAxis) >= 0 ? 1 : -1;

  session.exitDoorTracking = {
    doorPosition,
    crossingAxis,
    insideSign,
    halfExtentOnAxis: localThinIsX ? door.halfExtents.x : door.halfExtents.z,
  };
}

/**
 * Bascule vers l'écran de fin de niveau (Jalon M8 : envoie `LEVEL_COMPLETED`
 * à l'acteur de flux, remplace `state.setLevelComplete(true)`) — voir
 * `feedback.ts::handlePlayerHit` pour la même discussion sur
 * `session.levelCompleteHandled` face à la garde `flowState !== "playing"`
 * d'`updateGameplay`. Libère le pointeur (même geste qu'à la mort) : l'écran
 * de fin de niveau a besoin du curseur pour ses boutons.
 */
export function triggerLevelComplete(engine: GameEngine, session: GameSession): void {
  if (session.levelCompleteHandled) return;
  session.levelCompleteHandled = true;
  engine.flowActor.send({ type: "LEVEL_COMPLETED" });
  document.exitPointerLock();
}
