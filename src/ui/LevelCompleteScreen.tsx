import { useGameStore } from "../game/state";

/**
 * Écran de fin de niveau plein cadre. Même pattern que `DeathScreen.tsx` :
 * lit `state.flowState`, retourne `null` hors de l'état "levelComplete".
 * Aucun chrono — le plan le marque explicitement optionnel.
 *
 * Même identité visuelle que le reste du jeu — voir `DeathScreen.tsx`.
 * see: docs/systems/hud.md#écrans-de-mort-et-de-fin-de-niveau
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
    <div className="lc-root">
      <style>{LC_CSS}</style>
      <div className="lc-scanlines" />

      <div className="lc-panel">
        <div className="lc-corner lc-corner-tl" />
        <div className="lc-corner lc-corner-tr" />
        <div className="lc-corner lc-corner-bl" />
        <div className="lc-corner lc-corner-br" />
        <div className="lc-flag">TRANSMISSION ACHEVÉE</div>

        <div className="lc-title">ÉCHAPPÉ DE L'HYPERMARCHÉ</div>
        <div className="lc-body">Le monde n'est pas prêt à entendre la vérité. Mais toi, tu es dehors.</div>
        <div className="lc-stats">
          <div>{`Spectateurs en direct : ${views.toLocaleString("fr-FR")}`}</div>
          <div>{`Secrets trouvés : ${secretsFound} / ${secretsTotal}`}</div>
        </div>

        <div className="lc-buttons">
          <button className="lc-btn lc-btn-primary" onClick={onReplay}>
            ▶ REJOUER
          </button>
          <button className="lc-btn" onClick={onReturnToMenu}>
            ◀ RETOUR AU MENU
          </button>
        </div>
      </div>
    </div>
  );
}

const LC_CSS = `
.lc-root {
  position: fixed;
  inset: 0;
  z-index: 2000;
  pointer-events: auto;
  background: radial-gradient(ellipse at 50% 40%, #051808 0%, #020a03 70%, #010401 100%);
  color: #bfe8bf;
  font-family: "Courier New", ui-monospace, monospace;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.lc-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(120,255,140,0.05) 0px, rgba(120,255,140,0.05) 1px, transparent 2px, transparent 4px);
  mix-blend-mode: screen;
}
.lc-panel {
  position: relative;
  padding: 44px 56px 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  background: rgba(8, 22, 10, 0.55);
  border: 1px solid rgba(140, 255, 150, 0.3);
}
.lc-corner { position: absolute; width: 20px; height: 20px; border: 2px solid #6f6; opacity: 0.85; }
.lc-corner-tl { top: -2px; left: -2px; border-right: none; border-bottom: none; }
.lc-corner-tr { top: -2px; right: -2px; border-left: none; border-bottom: none; }
.lc-corner-bl { bottom: -2px; left: -2px; border-right: none; border-top: none; }
.lc-corner-br { bottom: -2px; right: -2px; border-left: none; border-top: none; }
.lc-flag {
  font-size: 11px;
  letter-spacing: 3px;
  color: #7fff9e;
  background: rgba(120,255,140,0.12);
  border: 1px solid rgba(140,255,150,0.5);
  padding: 3px 10px;
}
.lc-title { font-size: 28px; font-weight: 700; letter-spacing: 2px; color: #6bffa0; text-shadow: 0 0 16px rgba(90,255,140,0.5); text-align: center; }
.lc-body { max-width: 360px; text-align: center; font-size: 13.5px; line-height: 1.6; color: #a8d0a8; }
.lc-stats { display: flex; gap: 28px; font-size: 12px; color: #8fc08f; }
.lc-buttons { display: flex; gap: 12px; margin-top: 6px; }
.lc-btn {
  padding: 10px 18px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #bfe8bf;
  background: rgba(120,255,140,0.05);
  border: 1px solid rgba(140,255,150,0.35);
  cursor: pointer;
}
.lc-btn:hover { background: rgba(120,255,140,0.14); }
.lc-btn-primary { border-color: #7fff9e; color: #eafff0; }
`;
