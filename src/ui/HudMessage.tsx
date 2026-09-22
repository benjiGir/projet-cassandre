import { useGameStore } from "../game/state";
import { vpx } from "./hudScale";

/**
 * Message HUD transitoire (badge ramassé, porte verrouillée/déverrouillée...).
 * Purement présentationnel : lit `state.hudMessage`, n'écrit jamais dedans.
 * Canal SYSTÈME — voir `HeroLine.tsx` pour le canal RÉPLIQUE, distinct.
 * see: docs/systems/hud.md#deux-canaux-de-message-hudmessage-et-heroline
 */
export function HudMessage() {
  const message = useGameStore((s) => s.hudMessage);
  if (!message) return null;

  return (
    <>
      <style>{HM_CSS}</style>
      <div className="hm-box">
        <span className="hm-tick">▌</span> {message}
      </div>
    </>
  );
}

const HM_CSS = `
.hm-box {
  position: fixed;
  top: 72%;
  left: 50%;
  transform: translateX(-50%);
  color: #bfe8bf;
  font-family: "Courier New", ui-monospace, monospace;
  font-size: ${vpx(18)};
  letter-spacing: 0.5px;
  text-shadow: 1px 1px 2px #000;
  background: rgba(6, 16, 6, 0.7);
  border: ${vpx(1)} solid rgba(140,255,150,0.4);
  padding: ${vpx(5)} ${vpx(10)};
  pointer-events: none;
  user-select: none;
}
.hm-tick { color: #7fff9e; }
`;
