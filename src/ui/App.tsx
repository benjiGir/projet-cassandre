import { DebugPanel } from "./DebugPanel";
import { HudMessage } from "./HudMessage";
import { TuningPanel } from "./TuningPanel";

export function App() {
  return (
    <>
      <DebugPanel />
      <TuningPanel />
      <HudMessage />
    </>
  );
}
