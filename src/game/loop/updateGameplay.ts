import * as THREE from "three";
import { Effect } from "effect";

import { runGameplaySync } from "../../app/runtime/gameRuntime";
import { applyCampaignCommand } from "../devtools/campaignCommands";
import type { GameEngine } from "../session/gameEngine";
import type { GameSession } from "../session/gameSession";
import { updateLevelTrains } from "../session/player/levelTrainGameplay";
import { updatePickups } from "../session/player/pickups";
import { hasClearPickupPath } from "../session/player/pickupVisibility";
import { triggerLevelComplete } from "../session/progression/doors";
import { advanceGameplayTime } from "../session/progression/score";
import { handleDevGameplayInput } from "./devGameplayInput";
import { updateBreakables } from "./steps/breakableSteps";
import { fireWeapons, updateDirectors, updateSuits } from "./steps/combatSteps";
import type { GameplayStep } from "./steps/gameplayStep";
import { readInputFrame } from "./steps/inputStep";
import { useInteractions } from "./steps/interactionStep";
import {
  checkExitCrossing,
  collectDroppedCard,
  findSecrets,
  runLevelScript,
  updateDoors,
  updateLevelAmbience,
  updateLevelRules,
  updateNarration,
} from "./steps/levelSteps";
import { movePlayer, rescueFromFall } from "./steps/playerSteps";

// see: docs/6-reference/notes-code-gameplay.md#boucle-et-présentation

/**
 * Le contenu d'un pas fixe, dans l'ordre. Cet ordre fait partie du contrat du
 * rejeu : l'origine des tirs est prise après le déplacement du joueur, et les
 * ennemis passent après les armes pour voir les impacts du même pas.
 */
const GAMEPLAY_STEPS: readonly ((step: GameplayStep) => void)[] = [
  movePlayer,
  rescueFromFall,
  useInteractions,
  ({ engine, session }) =>
    updatePickups(engine.interaction, session, (useObject) =>
      runGameplaySync(hasClearPickupPath(session, useObject.position)),
    ),
  fireWeapons,
  updateSuits,
  updateLevelRules,
  updateDirectors,
  ({ engine, dt }) => updateLevelTrains(engine, dt),
  updateBreakables,
  updateLevelAmbience,
  updateDoors,
  collectDroppedCard,
  checkExitCrossing,
  findSecrets,
  runLevelScript,
  updateNarration,
];

const eyeOrigin = new THREE.Vector3();

function stepGameplay(engine: GameEngine, session: GameSession, fixedDt: number): void {
  if (import.meta.env.DEV) {
    while (session.run.devCampaignCommands.length > 0) {
      const command = session.run.devCampaignCommands.shift();
      if (command) applyCampaignCommand(engine, command);
      if (!engine.flow.isPlaying()) return;
    }
  }
  if (import.meta.env.DEV && session.run.devCompleteRequested) {
    session.run.devCompleteRequested = false;
    triggerLevelComplete(engine, session);
    return;
  }
  const dt = engine.clock.tick(fixedDt);
  engine.heroReflection.advance(dt);
  engine.fx.advanceMuzzleFlashes(dt);
  session.heroPortrait.advance(dt, session.run.playerHp, session.run.playerMaxHp);

  advanceGameplayTime(session.run.stats, dt);

  if (session.run.sanitaireReliefCooldown > 0) {
    session.run.sanitaireReliefCooldown = Math.max(0, session.run.sanitaireReliefCooldown - dt);
  }

  const step: GameplayStep = { engine, session, dt, frame: readInputFrame(engine), eyeOrigin };
  for (const run of GAMEPLAY_STEPS) run(step);
}

export function updateGameplay(engine: GameEngine, dt: number): void {
  const session = engine.session;
  if (import.meta.env.DEV && engine.flow.isPhysicsLive()) {
    runGameplaySync(Effect.sync(() => handleDevGameplayInput(engine, session)));
  }

  // Mort ou niveau terminé : le pas fixe continue de tourner (invariant #1),
  // seul son CONTENU est ignoré hors de l'état "playing". L'acteur de flux est
  // lu directement, jamais par zustand : `flowState` n'existe que pour React.
  // see: docs/archive/systems-boucle-de-jeu.md#fin-de-partie-pendant-le-pas-fixe
  if (!engine.flow.isPlaying()) return;

  // Un seul Effect synchrone pour tout le pas (invariant #11).
  runGameplaySync(Effect.sync(() => stepGameplay(engine, session, dt)));
}
