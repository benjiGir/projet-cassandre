import { Effect } from "effect";

import { runGameplaySync } from "../../core/runtime";
import { isPhysicsSessionLive, type GameEngine } from "../session/gameEngine";

/**
 * Extraction du refactor de `main.ts` (2229 lignes → modules, 2026-09-05) :
 * `snapshotPrevious`/`stepPhysics` (callbacks de `startLoop`, `core/loop.ts`)
 * déplacées telles quelles, `engine` en paramètre explicite au lieu d'une
 * fermeture sur le scope de `main()`.
 */

export function snapshotPrevious(engine: GameEngine): void {
  const session = engine.session;
  session.player.snapshotPrevious();
  session.weapons.snapshotPrevious();
  session.suitManager.snapshotPrevious();
  session.directorManager.snapshotPrevious();
  engine.ballPrevPos.copy(engine.ballCurrPos);
  engine.ballPrevQuat.copy(engine.ballCurrQuat);
}

/**
 * Jalon M8 : voir la doc de `isPhysicsSessionLive` — sans cette garde, la
 * fenêtre transitoire de `returnToMenu()` (session déjà `free()`-ée, pas
 * encore remplacée) ferait planter cet appel (accès à un monde Rapier WASM
 * déjà libéré). PAS la même garde que `updateGameplay` (celle-ci accepte
 * aussi `dead`/`levelComplete` : le monde y est encore parfaitement vivant,
 * seul le CONTENU du pas fixe est ignoré, invariant #1 — voir sa doc).
 *
 * Jalon M6 (PLAN_EFFECT_XSTATE.md, §8) : fait partie du pas fixe au sens de
 * l'invariant #1 (comme `updateGameplay`), donc du même périmètre —
 * trivial, un seul `Effect.sync`, aucune séquence à composer.
 */
export function stepPhysics(engine: GameEngine, dt: number): void {
  if (!isPhysicsSessionLive(engine)) return;
  const session = engine.session;
  runGameplaySync(
    Effect.sync(() => {
      session.physics.step(dt);
      // `ballBody` n'existe que sur le chemin "gym" (voir `bootGameSession`)
      // — rien à mettre à jour sinon, pas un bug.
      if (session.ballBody) {
        const t = session.ballBody.translation();
        const r = session.ballBody.rotation();
        engine.ballCurrPos.set(t.x, t.y, t.z);
        engine.ballCurrQuat.set(r.x, r.y, r.z, r.w);
      }
    }),
  );
}
