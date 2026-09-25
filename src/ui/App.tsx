import { DebugPanel } from "./dev/DebugPanel/DebugPanel";
import { TuningPanel } from "./dev/tuning/TuningPanel/TuningPanel";
import { FpsCounter } from "./hud/overlays/FpsCounter/FpsCounter";
import { Hud } from "./hud/Hud/Hud";
import { HudMessage } from "./hud/overlays/HudMessage/HudMessage";
import { DeathScreen } from "./screens/death/DeathScreen/DeathScreen";
import { LevelCompleteScreen } from "./screens/levelComplete/LevelCompleteScreen/LevelCompleteScreen";
import { PauseScreen } from "./screens/pause/PauseScreen/PauseScreen";

export interface AppProps {
  onReplay: () => void;
  onReturnToMenu: () => void;
  /** Reprend une partie en pause (redemande le verrouillage du pointeur, envoie RESUME) — voir `PauseScreen`. */
  onResume: () => void;
}

/**
 * Racine React montée en jeu, une fois le niveau chargé. Les menus d'avant la
 * partie sont rendus hors de cet arbre (`game/session/bootChoice.ts`).
 * `onReplay`/`onReturnToMenu`/`onResume` sont de vrais resets/transitions :
 * `main.ts`/`game/session/lifecycle.ts` restent les seuls à savoir QUOI faire
 * quand on clique.
 * see: docs/systems/hud.md#composition-de-app
 * see: docs/decisions/0019-machine-xstate-flux-ecran.md
 */
export function App({ onReplay, onReturnToMenu, onResume }: AppProps) {
  // `import.meta.env.DEV` est une constante au build : les panneaux de dev
  // quittent le bundle de production, pas seulement l'écran.
  return (
    <>
      {import.meta.env.DEV ? <DebugPanel /> : <FpsCounter />}
      {import.meta.env.DEV && <TuningPanel />}
      <Hud />
      <HudMessage />
      <PauseScreen onResume={onResume} onReturnToMenu={onReturnToMenu} />
      <DeathScreen onReplay={onReplay} onReturnToMenu={onReturnToMenu} />
      <LevelCompleteScreen onReplay={onReplay} onReturnToMenu={onReturnToMenu} />
    </>
  );
}
