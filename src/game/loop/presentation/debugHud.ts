import { input } from "../../../core/input/input";
import { useGameStore } from "../../hud/state";
import { astarMetricsSnapshot } from "../../level/navigation/navSearch";
import type { FxFrame } from "./fxFrame";

const DEBUG_UPDATE_INTERVAL = 1 / 10; // invariant #2 : 10 Hz maximum

// see: docs/archive/reference-controles.md#touches-de-dev
export function handleDebugKeys({ engine }: FxFrame): void {
  if (import.meta.env.DEV) {
    // KeyV : wireframe de toute la scène, mutation ponctuelle sur appui
    // (invariant #2 — pas de lecture continue, pas de setState par frame).
    if (input.wasJustPressed("KeyV")) {
      const enabled = engine.wireframeToggle.toggle();
      console.info(`[debug] wireframe ${enabled ? "activé" : "désactivé"}`);
    }
    // KeyB (ballistics) : gizmos balistiques de debug, actifs par défaut
    // en dev (voir la doc de tête de `render/debug/ballisticsDebug.ts`) — même pattern
    // de bascule ponctuelle que KeyV ci-dessus.
    if (input.wasJustPressed("KeyB")) {
      const enabled = engine.ballisticsDebug.toggle();
      console.info(`[debug] gizmos balistiques ${enabled ? "activés" : "désactivés"}`);
    }
  }
}

/** Publie au store ce que le HUD et le panneau de debug affichent, à 10 Hz au plus (invariant #2). */
export function publishDebugHud({ engine, session, realDt, stats }: FxFrame): void {
  engine.debugAccumulator += realDt;
  if (engine.debugAccumulator >= DEBUG_UPDATE_INTERVAL) {
    engine.debugAccumulator = 0;
    const astar = astarMetricsSnapshot();
    useGameStore.getState().setHeroPortrait(session.heroPortrait.view);
    useGameStore.getState().setDebug({
      fps: engine.fpsSmoothed,
      position: { x: engine.camera.position.x, y: engine.camera.position.y, z: engine.camera.position.z },
      entityCount: (session.mode?.entityCount ?? 0) + session.suitManager.suits.length,
      steps: stats.steps,
      // Définition exacte de ces durées : doc de `LoopStats` (`core/loop/loop.ts`).
      gameplayMs: stats.gameplayMs,
      gameplayP95Ms: stats.gameplayP95Ms,
      astarQueries: astar.queries,
      astarMisses: astar.misses,
      astarExpandedNodes: astar.expandedNodes,
      astarLastMs: astar.lastMs,
      astarMaxMs: astar.maxMs,
      physicsMs: stats.physicsMs,
      renderMs: stats.renderMs,
      drawCalls: engine.renderer.info.render.calls,
      triangles: engine.renderer.info.render.triangles,
      isGrounded: session.player.isGrounded,
      horizontalSpeed: session.player.horizontalSpeed,
      verticalSpeed: session.player.velocity.y,
      numCollisions: session.player.numCollisions,
      groundNormal: {
        x: session.player.groundNormal.x,
        y: session.player.groundNormal.y,
        z: session.player.groundNormal.z,
      },
      shotgunAmmo: session.weapons.shotgunAmmo,
      shotgunMaxAmmo: session.weapons.shotgunMaxAmmo,
      pistolAmmo: session.weapons.pistolAmmo,
      pistolMaxAmmo: session.weapons.pistolMaxAmmo,
      // HUD de prod (Phase 6, `ui/hud/widgets/AmmoPanel/AmmoPanel.tsx`) : quel libellé afficher pour
      // "munitions" dépend de l'arme active, pas seulement du compte de
      // cartouches. Même throttle 10 Hz que le reste de ce bloc.
      activeWeapon: session.weapons.activeWeapon,
    });
  }
}
