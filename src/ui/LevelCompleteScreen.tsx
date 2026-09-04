import { useGameStore } from "../game/state";

/**
 * Écran de fin de niveau plein cadre (Phase 6). Même pattern que
 * `DeathScreen.tsx` : lit `state.flowState` (Jalon M8, remplace l'ancien
 * booléen `isLevelComplete` — voir sa doc dans `game/state.ts`), retourne
 * `null` tant qu'il ne vaut pas `"levelComplete"`. Aucun chrono (le plan le
 * marque explicitement optionnel — pas construit ici).
 *
 * `onReplay`/`onReturnToMenu` : voir la doc de `DeathScreenProps` — mêmes
 * fonctions de reset réel, partagées entre les deux écrans (comme
 * `ui/screenNav.ts` avant ce jalon, désormais supprimé).
 */
export interface LevelCompleteScreenProps {
  onReplay: () => void;
  onReturnToMenu: () => void;
}

export function LevelCompleteScreen(props: LevelCompleteScreenProps) {
  const { onReplay, onReturnToMenu } = props;
  const flowState = useGameStore((s) => s.flowState);
  const views = useGameStore((s) => s.debug.views);
  const secretsFound = useGameStore((s) => s.debug.secretsFound);
  const secretsTotal = useGameStore((s) => s.debug.secretsTotal);
  if (flowState !== "levelComplete") return null;

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
        background: "rgba(0, 8, 0, 0.88)",
        color: "#eee",
        fontFamily: "monospace",
        pointerEvents: "auto",
        zIndex: 2000,
      }}
    >
      <div style={{ fontSize: 32, fontWeight: "bold", color: "#3f6", letterSpacing: 2 }}>ÉCHAPPÉ DE L'HYPERMARCHÉ</div>
      <div style={{ fontSize: 14, color: "#ccc", textAlign: "center", maxWidth: 360 }}>
        Le monde n'est pas prêt à entendre la vérité. Mais toi, tu es dehors.
      </div>
      <div style={{ display: "flex", gap: 32, fontSize: 13, color: "#bbb" }}>
        <div>{`Spectateurs en direct : ${views.toLocaleString("fr-FR")}`}</div>
        <div>{`Secrets trouvés : ${secretsFound} / ${secretsTotal}`}</div>
      </div>
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
