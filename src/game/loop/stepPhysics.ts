import { Effect } from "effect";

import { runGameplaySync } from "../../core/runtime";
import { isPhysicsSessionLive, type GameEngine } from "../session/gameEngine";

// `engine` est injecté en paramètre explicite (jamais une fermeture sur
// `main()`) depuis l'extraction de ce fichier hors de `main.ts`.
// see: docs/systems/boucle-de-jeu.md#origine-des-modules

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
 * PAS la même garde que `updateGameplay` (celle-ci accepte aussi
 * `dead`/`levelComplete` : le monde y est encore parfaitement vivant, seul
 * le CONTENU du pas fixe est ignoré, invariant #1). Sans cette garde-ci
 * (`isPhysicsSessionLive`), la fenêtre transitoire de `returnToMenu()`
 * (session déjà `free()`-ée, pas encore remplacée) ferait planter cet appel
 * (accès à un monde Rapier WASM déjà libéré).
 * see: docs/decisions/0013-garde-flux-vs-monde-physique.md
 *
 * Un seul `Effect.sync` (pas de phases `Effect.gen` comme
 * `updateGameplay`/`updateFx`) : un seul appel à effectuer, rien à séquencer.
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
