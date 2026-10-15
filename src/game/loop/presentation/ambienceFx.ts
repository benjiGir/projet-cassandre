import * as THREE from "three";

import { playTrainWarning } from "../../../core/audio/audio";
import { updateShowerAmbience } from "../../../core/audio/showerAmbience";
import { updateWaterAmbience } from "../../../core/audio/waterAmbience";
import { updateZoneAmbience } from "../../../core/audio/zoneAmbience";
import { collectActiveShowerOrigins } from "../../level/sanitaires/douches";
import type { FxFrame } from "./fxFrame";

const waterListenerRightScratch = new THREE.Vector3();
const waterJetOriginScratch: THREE.Vector3[] = [];
const showerOriginScratch: THREE.Vector3[] = [];

export function presentTrainWarnings({ session }: FxFrame): void {
  session.mode?.present?.();
  const levelTrains = session.gltfLevelSession?.current?.trains;
  const levelWarnings = levelTrains?.system.takeWarningSounds() ?? 0;
  if (levelWarnings > 0 && levelTrains?.config.soundWarning) playTrainWarning();
}

/** Ambiances positionnelles : jets d'eau, zones, douches, entendus depuis la caméra. */
export function updateAmbiences({ engine, session, realDt }: FxFrame): void {
  // see: docs/archive/systems-hud-audio.md#boucle-deau-positionnelle
  if (session.level.sanitaireSystem) session.level.sanitaireSystem.collectActiveJetOrigins(waterJetOriginScratch);
  else waterJetOriginScratch.length = 0;
  waterListenerRightScratch.set(1, 0, 0).applyQuaternion(engine.camera.quaternion);
  updateWaterAmbience(
    engine.camera.position,
    waterListenerRightScratch,
    waterJetOriginScratch,
    realDt,
    engine.flow.isPlaying(),
  );
  updateZoneAmbience(engine.camera.position, realDt, engine.flow.isPlaying());
  const levelRoot = session.gltfLevelSession?.current?.root ?? null;
  collectActiveShowerOrigins(levelRoot, showerOriginScratch);
  updateShowerAmbience(
    engine.camera.position,
    waterListenerRightScratch,
    showerOriginScratch,
    realDt,
    engine.flow.isPlaying(),
  );
}
