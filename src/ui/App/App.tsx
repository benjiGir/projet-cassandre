import { DebugPanel } from "../dev/DebugPanel/DebugPanel";
import { TuningPanel } from "../dev/tuning/TuningPanel/TuningPanel";
import { FpsCounter } from "../hud/overlays/FpsCounter/FpsCounter";
import { Hud } from "../hud/Hud/Hud";
import { Announcement } from "../hud/overlays/Announcement/Announcement";
import { HudMessage } from "../hud/overlays/HudMessage/HudMessage";
import { PerkOffer } from "../hud/overlays/PerkOffer/PerkOffer";
import { DeathScreen } from "../screens/death/DeathScreen/DeathScreen";
import { LevelCompleteScreen } from "../screens/levelComplete/LevelCompleteScreen/LevelCompleteScreen";
import { PauseScreen } from "../screens/pause/PauseScreen/PauseScreen";
import { LoadingScreen } from "../screens/loading/LoadingScreen/LoadingScreen";
import { StoryScreen } from "../screens/story/StoryScreen/StoryScreen";
import { useGameStore } from "../../game/hud/state";

export interface AppProps {
  onReplay: () => void;
  onNextLevel?: () => void;
  onReturnToMenu: () => void;
  onResume: () => void;
  onIntroDone: () => void;
  onOutroDone: () => void;
}

// see: docs/archive/systems-hud.md#composition-de-app
export function App({ onReplay, onNextLevel, onReturnToMenu, onResume, onIntroDone, onOutroDone }: AppProps) {
  const flowState = useGameStore((state) => state.flowState);
  if (flowState === "loading" || flowState === "loadFailed") return <LoadingScreen />;

  return (
    <>
      {import.meta.env.DEV ? <DebugPanel /> : <FpsCounter />}
      {import.meta.env.DEV && <TuningPanel />}
      <Hud />
      <PerkOffer />
      <HudMessage />
      <Announcement />
      <PauseScreen onResume={onResume} onReturnToMenu={onReturnToMenu} />
      <DeathScreen onReplay={onReplay} onReturnToMenu={onReturnToMenu} />
      <StoryScreen sequence="intro" doneLabel="LANCER LE DIRECT" onDone={onIntroDone} />
      <StoryScreen sequence="outro" doneLabel="VOIR LE BILAN" onDone={onOutroDone} />
      <LevelCompleteScreen onReplay={onReplay} onNextLevel={onNextLevel} onReturnToMenu={onReturnToMenu} />
    </>
  );
}
