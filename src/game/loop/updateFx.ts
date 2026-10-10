import * as THREE from "three";
import { Effect } from "effect";

import { runGameplaySync } from "../../app/runtime/gameRuntime";
import type { LoopStats } from "../../core/loop/loop";
import { useGameStore } from "../hud/state";
import type { GameEngine } from "../session/gameEngine";
import { presentPlayerDamage } from "../session/player/feedback";
import { presentTrainWarnings, updateAmbiences } from "./presentation/ambienceFx";
import { presentBreakableEvents, presentDoorEvents, presentPropEvents } from "./presentation/breakFx";
import { handleDebugKeys, publishDebugHud } from "./presentation/debugHud";
import { presentDirectorEvents, presentSuitEvents } from "./presentation/enemyFx";
import type { FxFrame } from "./presentation/fxFrame";
import { presentWeaponEvents } from "./presentation/weaponFx";

// see: docs/6-reference/notes-code-gameplay.md#boucle-et-présentation

// Scratch de l'offset de screenshake, réutilisé à chaque image.
const shakeOffsetScratch = new THREE.Vector3();

function advanceEffects({ engine, session, realDt }: FxFrame): void {
  if (realDt > 0) {
    engine.fpsSmoothed += (1 / realDt - engine.fpsSmoothed) * 0.1;
  }

  engine.fx.update(realDt);
  // see: docs/decisions/0026-visibilite-par-espace-et-pool-de-lampes.md
  session.level.lightPool?.update(engine.camera.position);
  engine.hitmarker.update(realDt);
  engine.crosshair.update(realDt);
  engine.ballisticsDebug.update(realDt);
}

function advancePickupBillboards({ engine, session, realDt }: FxFrame): void {
  session.pickupResources?.advanceWeaponClock(realDt);
  for (const billboard of session.level.weaponPickupBillboards) billboard.update(engine.camera);
  for (const billboard of session.level.cardPickupBillboards) billboard.update(engine.camera, realDt);
  session.droppedCardBillboard?.update(engine.camera, realDt);
}

// Chaque étape lit les files d'événements accumulées par les pas fixes depuis
// l'image précédente, puis vide les siennes : un événement est présenté une fois.
function presentFrame(frame: FxFrame): void {
  const { engine, session } = frame;
  advanceEffects(frame);
  presentTrainWarnings(frame);
  presentWeaponEvents(frame);
  advancePickupBillboards(frame);
  const hitBySuit = presentSuitEvents(frame);
  const hitByDirector = presentDirectorEvents(frame);
  if (hitBySuit || hitByDirector || useGameStore.getState().debug.playerHp !== session.run.playerHp)
    presentPlayerDamage(session.run.playerHp);
  presentPropEvents(frame);
  presentBreakableEvents(frame);
  presentDoorEvents(frame);
  updateAmbiences(frame);
  engine.camera.position.add(engine.fx.currentShakeOffset(shakeOffsetScratch));
  handleDebugKeys(frame);
  publishDebugHud(frame);
  engine.crosshair.render();
  engine.hitmarker.render();
}

// Tourne au taux d'affichage, comme `interpolateVisuals`, derrière la même
// frontière Effect synchrone que le pas fixe (invariant #11).
// see: docs/archive/systems-boucle-de-jeu.md#frontière-effect-synchrone-du-pas-fixe
export function updateFx(engine: GameEngine, realDt: number, stats: LoopStats): void {
  const frame: FxFrame = { engine, session: engine.session, realDt, stats };
  runGameplaySync(Effect.sync(() => presentFrame(frame)));
}
