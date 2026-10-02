import { DebugPanel } from "./dev/DebugPanel/DebugPanel";
import { TuningPanel } from "./dev/tuning/TuningPanel/TuningPanel";
import { FpsCounter } from "./hud/overlays/FpsCounter/FpsCounter";
import { Hud } from "./hud/Hud/Hud";
import { HudMessage } from "./hud/overlays/HudMessage/HudMessage";
import { DeathScreen } from "./screens/death/DeathScreen/DeathScreen";
import { LevelCompleteScreen } from "./screens/levelComplete/LevelCompleteScreen/LevelCompleteScreen";
import { PauseScreen } from "./screens/pause/PauseScreen/PauseScreen";
import { LoadingScreen } from "./screens/loading/LoadingScreen/LoadingScreen";
import { useGameStore } from "../game/state";

export interface AppProps {
  onReplay: () => void;
  onReturnToMenu: () => void;
  onResume: () => void;
}

// see: docs/archive/systems-hud.md#composition-de-app
export function App({ onReplay, onReturnToMenu, onResume }: AppProps) {
  const flowState = useGameStore((state) => state.flowState);
  if (flowState === "loading" || flowState === "loadFailed") return <LoadingScreen />;

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
