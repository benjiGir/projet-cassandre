import * as THREE from "three";

import { playSfx } from "../../../core/audio/audio";
import { CardPickupBillboard } from "../../../render/pickups/cardPickups";
import { updateStoreSign } from "../../../render/environment/storeSign";
import { DIRECTOR_DROPPED_CARD, directorConfig } from "../../entities/director/directorConfig";
import { suitConfig } from "../../entities/suit/suitConfig";
import { useGameStore } from "../../hud/state";
import type { DoorActor } from "../../level/doors/doorTypes";
import { updateShowers } from "../../level/sanitaires/douches";
import { startLevelScenario, updateLevelScript } from "../../level/scripting/levelScript";
import { moveConfig } from "../../player/movement/moveConfig";
import type { GameSession } from "../../session/gameSession";
import { showHudMessage, triggerHeroLine } from "../../session/player/feedback";
import { updateMetroMoments } from "../../session/player/metroMoments";
import { updatePlaceLine } from "../../session/player/placeLines";
import { SECRET_LINES } from "../../session/presentation/heroLines";
import { grantCard } from "../../session/progression/cards";
import { triggerLevelComplete } from "../../session/progression/doors";
import { LEVEL_EVENTS } from "../../session/progression/levelEvents";
import { runScriptAction } from "../../session/progression/levelScriptActions";
import { streamEvent, updateStreamFeed } from "../../session/stream/streamFeed";
import type { GameplayStep } from "./gameplayStep";

const EXIT_CROSSING_MARGIN = 1.0;

// see: docs/archive/reference-conventions-nommage.md#portes-animées
const doorActorPool: DoorActor[] = [];

function doorActorSlot(index: number): DoorActor {
  let slot = doorActorPool[index];
  if (!slot) {
    slot = { position: new THREE.Vector3(), radius: 0, halfHeight: 0, joueur: false };
    doorActorPool[index] = slot;
  }
  return slot;
}

/** Joueur + ennemis VIVANTS de la session courante, au format attendu par `DoorSystem.update`. */
function collectDoorActors(session: GameSession): readonly DoorActor[] {
  let count = 0;

  const player = doorActorSlot(count++);
  player.position.copy(session.player.position);
  player.radius = moveConfig.capsuleRadius;
  player.halfHeight = moveConfig.capsuleHalfHeight;
  player.joueur = true;

  for (const suit of session.suitManager.suits) {
    if (!suit.isAlive) continue;
    const slot = doorActorSlot(count++);
    slot.position.copy(suit.position);
    slot.radius = suitConfig.capsuleRadius;
    slot.halfHeight = suitConfig.capsuleHalfHeight;
    slot.joueur = false;
  }
  for (const director of session.directorManager.directors) {
    if (!director.isAlive) continue;
    const slot = doorActorSlot(count++);
    slot.position.copy(director.position);
    slot.radius = directorConfig.capsuleRadius;
    slot.halfHeight = directorConfig.capsuleHalfHeight;
    slot.joueur = false;
  }

  doorActorPool.length = count;
  return doorActorPool;
}

const exitDoorOffsetScratch = new THREE.Vector3();

/** Règles propres au niveau : celles d'un mode construit à la main, puis le parcours du métro. */
export function updateLevelRules({ engine, session, dt, frame }: GameplayStep): void {
  session.mode?.fixedStep?.(engine, dt, frame.use);
  const blockout = session.gltfLevelSession?.current?.metroBlockout;
  blockout?.fixed(dt, session.player.position);
  for (const event of blockout?.takeEncounterEvents() ?? []) {
    startLevelScenario(session.run.levelScript, session.choice.scenarios ?? LEVEL_EVENTS, event);
  }
  for (const message of blockout?.takeMessages() ?? []) showHudMessage(message);
  if (blockout?.completed) triggerLevelComplete(engine, session);
}

/** Décor animé au pas fixe : douches, fontaine, enseigne. */
export function updateLevelAmbience({ session, dt }: GameplayStep): void {
  updateShowers(session.gltfLevelSession?.current?.root ?? null, dt);
  session.gltfLevelSession?.current?.fountainWater?.fixed(dt);
  updateStoreSign(session.gltfLevelSession?.current?.root ?? null, dt);
}

export function updateDoors({ session, dt }: GameplayStep): void {
  session.level.doorSystem?.update(dt, collectDoorActors(session));
}

/** La carte que le Directeur lâche à sa mort : posée au sol, puis ramassée en marchant dessus. */
export function collectDroppedCard({ engine, session }: GameplayStep): void {
  const dropped = session.directorManager.droppedCard;
  if (dropped && !dropped.collected && !session.droppedCardBillboard) {
    session.droppedCardBillboard = new CardPickupBillboard(dropped.card, dropped.position, engine.cardPickupTextures);
    engine.scene.add(session.droppedCardBillboard.spriteMesh);
  }
  if (session.directorManager.tryCollectCard(session.player.position)) {
    session.droppedCardBillboard?.dispose();
    session.droppedCardBillboard = null;
    const carte = dropped?.card ?? DIRECTOR_DROPPED_CARD;
    if (grantCard(session, carte)) {
      triggerHeroLine(session, `carte_${carte}`);
      streamEvent(session, "carte");
    }
  }
}

/** Fin de niveau : le joueur a franchi la porte de sortie, marge comprise. */
export function checkExitCrossing({ engine, session }: GameplayStep): void {
  if (session.run.exitDoorTracking) {
    exitDoorOffsetScratch.subVectors(session.player.position, session.run.exitDoorTracking.doorPosition);
    const signedInsideDistance =
      exitDoorOffsetScratch.dot(session.run.exitDoorTracking.crossingAxis) * session.run.exitDoorTracking.insideSign;
    if (signedInsideDistance < -(session.run.exitDoorTracking.halfExtentOnAxis + EXIT_CROSSING_MARGIN)) {
      triggerLevelComplete(engine, session);
    }
  }
}

export function findSecrets({ session }: GameplayStep): void {
  // Secrets : présence dans le volume AABB, voir la doc de `foundSecrets`
  // dans `GameSession`. `secrets` est RELUE ici à chaque appel, jamais
  // mise en cache — même discipline que `useObjects`/`doors` ci-dessus.
  for (const secret of session.gltfLevelSession?.current?.secrets ?? []) {
    if (session.run.foundSecrets.has(secret.object)) continue;
    const p = session.player.position;
    const inside =
      p.x >= secret.min.x &&
      p.x <= secret.max.x &&
      p.y >= secret.min.y &&
      p.y <= secret.max.y &&
      p.z >= secret.min.z &&
      p.z <= secret.max.z;
    if (!inside) continue;
    session.run.foundSecrets.add(secret.object);
    const found = ++session.run.secretsFound;
    const total = session.level.secretsTotal;
    useGameStore.getState().setDebug({ secretsFound: found });
    // Info FACTUELLE (n/total, sans cooldown) + réplique de réaction
    // (canal dédié, cooldownée) — même partage que `onToiletUse`.
    showHudMessage(`Secret trouvé ! (${found}/${total})`);
    playSfx("secret_found");
    session.heroPortrait.react("discover");
    triggerHeroLine(session, SECRET_LINES[secret.name] ?? "secret_generique");
    streamEvent(session, "secret");
  }
}

export function runLevelScript({ engine, session, dt }: GameplayStep): void {
  updateLevelScript(
    session.run.levelScript,
    session.level.scriptTriggers,
    session.choice.scenarios ?? LEVEL_EVENTS,
    dt,
    session.player.position,
    (action) => runScriptAction(engine, session, action),
  );
}

/** Ce que le héros et le direct disent du pas écoulé. */
export function updateNarration({ session, dt }: GameplayStep): void {
  updateMetroMoments(session);

  // En dernier : une réplique d'événement (secret, carte, arme, moment
  // scripté) dite dans ce pas passe avant celle de la pièce.
  updatePlaceLine(session, dt);

  updateStreamFeed(session, dt);
}
