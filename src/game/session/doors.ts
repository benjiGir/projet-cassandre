import * as THREE from "three";

import { playDoorSfx } from "../../core/audio";
import { LOYALTY_CARD_LABELS, type LoyaltyCard } from "../player/loyaltyCards";
import { hasCard } from "./cards";
import { showHudMessage } from "./feedback";
import { publishLevelRecap } from "./score";
import { type GameSession } from "./gameSession";
import { type GameEngine } from "./gameEngine";

/**
 * Déverrouille le GROUPE de vantaux contenant `targetName` (voir `groupe`
 * dans `game/level/doors.ts` — une porte double s'ouvre entière) : la
 * traversée du mesh est déléguée à `session.doorSystem`, reconstruit à
 * chaque chargement comme `PropSystem`. Le groupe reste ouvert pour de bon
 * (`permanent`, quel que soit `referme`) — c'est la règle du contrat pour
 * toute porte à carte/`use_*`. Retourne `false` sans effet si `targetName` ne
 * correspond à aucun `door_*` du niveau courant (erreur de données Blender,
 * pas un état de jeu valide).
 * see: docs/systems/session.md#portes-et-fin-de-niveau
 * see: docs/decisions/0031-portes-animees-et-vitres.md
 */
export function unlockDoor(session: GameSession, targetName: string, successMessage: string): boolean {
  const opened = session.doorSystem?.open(targetName, session.player.position) ?? false;
  if (!opened) {
    console.error(`[main] use_* référence une porte introuvable ("${targetName}").`);
    return false;
  }
  session.unlockedDoors.add(targetName);
  showHudMessage(successMessage);
  playDoorSfx("unlock");
  return true;
}

/**
 * Tentative d'ouverture d'une porte gardée par une carte de fidélité
 * (jalon N7) : déverrouille si la carte est en poche, refuse sinon — message
 * et son, sans jamais consommer le `use_*`, donc réessayable.
 *
 * Seules les PORTES DE SORTIE arment le suivi de fin de niveau (voir la doc
 * de `ExitDoorTracking`) : une autre porte à carte partage exactement la même
 * mécanique sans jamais être une sortie.
 *
 * see: docs/systems/session.md#cartes-de-fidélité
 */
/**
 * Les portes qui terminent le niveau, par NOM. `door_e_exit` est celle de
 * l'ancien niveau complet (Zone E) ; `door_exit` celle du niveau v2. Les deux
 * donnent sur un « dehors » qui n'est pas modélisé : sans ce suivi, le joueur
 * franchit la porte et tombe dans le vide au lieu de finir la partie — c'est
 * exactement ce qui arrivait au niveau v2 avant le 2026-09-16.
 */
export function estPorteDeSortie(doorName: string): boolean {
  return doorName === "door_e_exit" || doorName === "door_exit";
}

export function tryOpenCardDoor(session: GameSession, targetName: string, required: LoyaltyCard): boolean {
  if (session.unlockedDoors.has(targetName)) return false; // déjà déverrouillée
  if (!hasCard(session, required)) {
    showHudMessage(`${LOYALTY_CARD_LABELS[required]} requise`);
    playDoorSfx("locked");
    return false;
  }
  const ouverte = unlockDoor(session, targetName, "Porte déverrouillée");
  if (ouverte && estPorteDeSortie(targetName)) setupExitDoorTracking(session, targetName);
  return ouverte;
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
 * Bascule vers l'écran de fin de niveau (`LEVEL_COMPLETED` envoyé à
 * l'acteur de flux) et libère le pointeur, même geste qu'à la mort — voir
 * `feedback.ts::applyPlayerDamage` pour la même discussion d'idempotence
 * appliquée à `session.levelCompleteHandled`.
 * see: docs/systems/session.md#portes-et-fin-de-niveau
 */
export function triggerLevelComplete(engine: GameEngine, session: GameSession): void {
  if (session.levelCompleteHandled) return;
  session.levelCompleteHandled = true;
  // Récap COMPLET (bonus de chrono compris) — AVANT l'envoi de l'évènement,
  // pour que `LevelCompleteScreen` trouve `state.recap` déjà rempli dès son
  // premier rendu après le changement de `flowState`.
  // see: docs/systems/session.md#récapitulatif-de-fin-de-partie
  publishLevelRecap(session, true);
  engine.flowActor.send({ type: "LEVEL_COMPLETED" });
  document.exitPointerLock();
}
