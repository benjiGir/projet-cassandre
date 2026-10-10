import { Effect } from "effect";

import { runGameplaySync } from "../../app/runtime/gameRuntime";
import { isPhysicsSessionLive, type GameEngine } from "../session/gameEngine";
// `engine` est injecté en paramètre explicite (jamais une fermeture sur
// `main()`) depuis l'extraction de ce fichier hors de `main.ts`.
// see: docs/archive/systems-boucle-de-jeu.md#origine-des-modules

export function snapshotPrevious(engine: GameEngine): void {
  const session = engine.session;
  session.player.snapshotPrevious();
  session.weapons.snapshotPrevious();
  session.suitManager.snapshotPrevious();
  session.directorManager.snapshotPrevious();
  session.level.propSystem?.snapshotPrevious();
  session.level.doorSystem?.snapshotPrevious();
  session.mode?.snapshotPrevious?.();
}

// see: docs/decisions/0013-garde-flux-vs-monde-physique.md
// Vérifier le monde vivant avant tout accès WASM ; le flux écran seul ne suffit pas.
export function stepPhysics(engine: GameEngine, dt: number): void {
  if (!isPhysicsSessionLive(engine)) return;
  const session = engine.session;
  runGameplaySync(
    Effect.sync(() => {
      session.physics.step(dt);
      // Props : relus APRÈS le pas, jamais avant — c'est ce pas-ci qui vient
      // d'intégrer les impulsions posées par `updateGameplay`.
      session.level.propSystem?.syncFromPhysics();
      session.mode?.syncFromPhysics?.();
    }),
  );
}
