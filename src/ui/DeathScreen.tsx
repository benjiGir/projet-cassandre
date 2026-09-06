import { useGameStore } from "../game/state";

/**
 * Écran de mort plein cadre. Purement présentationnel : lit `state.flowState`,
 * retourne `null` hors de l'état "dead". `onReplay`/`onReturnToMenu` sont de
 * VRAIES fonctions de reset passées par `App.tsx`, jamais un rechargement de
 * page.
 * see: docs/systems/hud.md#écrans-de-mort-et-de-fin-de-niveau
 * see: docs/decisions/0019-machine-xstate-flux-ecran.md
 */
export interface DeathScreenProps {
  onReplay: () => void;
  onReturnToMenu: () => void;
}

export function DeathScreen(props: DeathScreenProps) {
  const { onReplay, onReturnToMenu } = props;
  const flowState = useGameStore((s) => s.flowState);
  const views = useGameStore((s) => s.debug.views);
  if (flowState !== "dead") return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        background: "rgba(10, 0, 0, 0.88)",
        color: "#eee",
        fontFamily: "monospace",
        pointerEvents: "auto",
        zIndex: 2000,
      }}
    >
      <div style={{ fontSize: 32, fontWeight: "bold", color: "#f44", letterSpacing: 2 }}>STREAM COUPÉ</div>
      <div style={{ fontSize: 14, color: "#ccc", textAlign: "center", maxWidth: 360 }}>
        Ils ont eu ta connexion. Encore une preuve, pense les 200 abonnés restants.
      </div>
      <div style={{ fontSize: 13, color: "#999" }}>{`Spectateurs au moment de la coupure : ${views.toLocaleString("fr-FR")}`}</div>
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button
          onClick={onReplay}
          style={{
            padding: "10px 20px",
            fontFamily: "monospace",
            fontSize: 14,
            color: "#0f0",
            background: "rgba(0, 255, 0, 0.08)",
            border: "1px solid #4a4",
            cursor: "pointer",
            pointerEvents: "auto",
          }}
        >
          Rejouer
        </button>
        <button
          onClick={onReturnToMenu}
          style={{
            padding: "10px 20px",
            fontFamily: "monospace",
            fontSize: 14,
            color: "#ddd",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid #444",
            cursor: "pointer",
            pointerEvents: "auto",
          }}
        >
          Retour au menu principal
        </button>
      </div>
    </div>
  );
}
