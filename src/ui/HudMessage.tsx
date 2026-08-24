import { useGameStore } from "../game/state";

/**
 * Message HUD transitoire (badge ramassé, porte verrouillée/déverrouillée...).
 * Purement présentationnel : lit `state.hudMessage`, n'écrit jamais dedans
 * (l'auto-effacement est géré par `main.ts` via `setTimeout`, voir
 * `game/state.ts`). Boîte blanche volontaire (invariant #9) — pas de style
 * final, juste un retour visible en jeu.
 */
export function HudMessage() {
  const message = useGameStore((s) => s.hudMessage);
  if (!message) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "72%",
        left: "50%",
        transform: "translateX(-50%)",
        color: "#fff",
        fontFamily: "monospace",
        fontSize: 18,
        textShadow: "1px 1px 2px #000",
        background: "rgba(0, 0, 0, 0.55)",
        padding: "6px 16px",
        borderRadius: 4,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {message}
    </div>
  );
}
