import { Effect } from "effect";

import { runGameplaySync } from "../../app/gameRuntime";
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
  session.propSystem?.snapshotPrevious();
  session.doorSystem?.snapshotPrevious();
  engine.ballPrevPos.copy(engine.ballCurrPos);
  engine.ballPrevQuat.copy(engine.ballCurrQuat);
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
      session.propSystem?.syncFromPhysics();
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
