import { useGameStore } from "../game/state";

/**
 * Réplique du héros — canal dédié (`state.heroLine`), distinct du canal
 * système `HudMessage`. Purement présentationnel : lit le store, n'écrit
 * jamais dedans ; l'auto-effacement et le cooldown vivent côté appelant.
 * see: docs/systems/hud.md#deux-canaux-de-message-hudmessage-et-heroline
 */
export function HeroLine() {
  const line = useGameStore((s) => s.heroLine);
  if (!line) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 220,
        right: 12,
        maxWidth: 320,
        color: "#ffe27a",
        fontFamily: "monospace",
        fontSize: 13,
        lineHeight: 1.4,
        textShadow: "1px 1px 2px #000",
        background: "rgba(20, 15, 0, 0.6)",
        border: "1px solid rgba(255, 226, 122, 0.35)",
        borderRadius: 4,
        padding: "6px 10px",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <span style={{ opacity: 0.7, fontSize: 10, display: "block", marginBottom: 2 }}>RÉVEIL_DU_PEUPLE dit :</span>
      {line}
    </div>
  );
}
