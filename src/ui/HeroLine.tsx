import { useGameStore } from "../game/state";

/**
 * Réplique du héros — canal DÉDIÉ (`state.heroLine`), distinct du canal
 * système `HudMessage`/`state.hudMessage`. Purement présentationnel, comme
 * `HudMessage.tsx` : lit le store, n'écrit jamais dedans, l'auto-effacement
 * et le cooldown de 15 s (skill `audio-sfx-pipeline`) sont gérés côté
 * appelant (`main.ts::triggerHeroLine`), pas ici.
 *
 * Positionné comme une LÉGENDE DE STREAM sous la webcam factice (voir
 * `ui/Hud.tsx`) — c'est le héros qui commente sa propre vidéo, cohérent avec
 * la direction artistique "overlay de stream" du plan. Volontairement
 * distinct visuellement de `HudMessage` (centré, plus haut, fond neutre) :
 * l'un est une INFORMATION système, l'autre une RÉPLIQUE de personnage.
 *
 * Haut-DROITE, sous la webcam : suit son déplacement (voir la doc de tête
 * de `ui/Hud.tsx` — le coin haut-gauche reste celui de `DebugPanel`).
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
