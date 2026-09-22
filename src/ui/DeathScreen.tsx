import { useGameStore } from "../game/state";

/**
 * Écran de mort plein cadre. Purement présentationnel : lit `state.flowState`,
 * retourne `null` hors de l'état "dead". `onReplay`/`onReturnToMenu` sont de
 * VRAIES fonctions de reset passées par `App.tsx`, jamais un rechargement de
 * page.
 *
 * "Perte de signal" — neige TV, alerte rouge : même identité visuelle que le
 * menu principal et le reste du HUD.
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
    <div className="ds-root">
      <style>{DS_CSS}</style>
      <div className="ds-static" />
      <div className="ds-bars" />

      <div className="ds-panel">
        <div className="ds-corner ds-corner-tl" />
        <div className="ds-corner ds-corner-tr" />
        <div className="ds-corner ds-corner-bl" />
        <div className="ds-corner ds-corner-br" />
        <div className="ds-flag">SIGNAL PERDU</div>

        <div className="ds-title">STREAM COUPÉ</div>
        <div className="ds-body">Ils ont eu ta connexion. Encore une preuve, pense les 200 abonnés restants.</div>
        <div className="ds-stat">{`Spectateurs au moment de la coupure : ${views.toLocaleString("fr-FR")}`}</div>

        <div className="ds-buttons">
          <button className="ds-btn ds-btn-primary" onClick={onReplay}>
            ▶ RECONNECTER
          </button>
          <button className="ds-btn" onClick={onReturnToMenu}>
            ◀ RETOUR AU MENU
          </button>
        </div>
      </div>
    </div>
  );
}

const DS_CSS = `
.ds-root {
  position: fixed;
  inset: 0;
  z-index: 2000;
  pointer-events: auto;
  background: radial-gradient(ellipse at 50% 40%, #180505 0%, #0a0202 70%, #050101 100%);
  color: #f3c9c9;
  font-family: "Courier New", ui-monospace, monospace;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.ds-static {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.06;
  background-image: repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 2px),
    repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px);
  mix-blend-mode: overlay;
  animation: ds-flicker 0.15s steps(2) infinite;
}
@keyframes ds-flicker { 0% { opacity: 0.04; } 50% { opacity: 0.09; } 100% { opacity: 0.05; } }
.ds-bars {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(255,60,60,0.04) 0px, rgba(255,60,60,0.04) 2px, transparent 2px, transparent 5px);
}
.ds-panel {
  position: relative;
  padding: 44px 56px 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  background: rgba(20, 5, 5, 0.6);
  border: 1px solid rgba(255, 100, 100, 0.3);
}
.ds-corner { position: absolute; width: 20px; height: 20px; border: 2px solid #f66; opacity: 0.85; }
.ds-corner-tl { top: -2px; left: -2px; border-right: none; border-bottom: none; }
.ds-corner-tr { top: -2px; right: -2px; border-left: none; border-bottom: none; }
.ds-corner-bl { bottom: -2px; left: -2px; border-right: none; border-top: none; }
.ds-corner-br { bottom: -2px; right: -2px; border-left: none; border-top: none; }
.ds-flag {
  font-size: 11px;
  letter-spacing: 3px;
  color: #ff5b5b;
  background: rgba(255,60,60,0.12);
  border: 1px solid rgba(255,90,90,0.5);
  padding: 3px 10px;
  animation: ds-blink 0.9s steps(1) infinite;
}
@keyframes ds-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.3; } }
.ds-title { font-size: 34px; font-weight: 700; letter-spacing: 3px; color: #ff6b6b; text-shadow: 0 0 16px rgba(255,60,60,0.5); }
.ds-body { max-width: 360px; text-align: center; font-size: 13.5px; line-height: 1.6; color: #e6b8b8; }
.ds-stat { font-size: 12px; color: #b88; }
.ds-buttons { display: flex; gap: 12px; margin-top: 6px; }
.ds-btn {
  padding: 10px 18px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #f3c9c9;
  background: rgba(255,90,90,0.06);
  border: 1px solid rgba(255,110,110,0.4);
  cursor: pointer;
}
.ds-btn:hover { background: rgba(255,90,90,0.16); }
.ds-btn-primary { border-color: #ff8080; color: #ffe0e0; }
`;
