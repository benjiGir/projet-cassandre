import { useState } from "react";

/**
 * Menu principal — "Jouer" / "Options" / "Quitter". Distinct de
 * `LevelMenu.tsx` (outil de dev pour choisir une zone individuelle) : les
 * deux ne sont pas fusionnés. Purement présentationnel, comme `LevelMenu.tsx` :
 * aucun import `src/game/*`, tout arrive par props.
 *
 * "Signal intercepté" — scanlines, vignette, bracket de visée, ticker qui
 * défile : prolonge l'identité stream/complot du HUD (webcam, "EN DIRECT")
 * jusque dans le menu, plutôt que de s'arrêter à son bord.
 * see: docs/systems/hud.md#menu-principal-et-écran-de-choix-de-niveau
 */

export interface MainMenuProps {
  onPlay: () => void;
  onOptions: () => void;
  /** Lien discret vers `LevelMenu` (choix de zone, outil de dev). */
  /** Absent = pas de bouton. Le choix de zone est un outil de DEV : il ne
   * s'affiche pas dans un build de production (voir `game/session/bootChoice.ts`). */
  onChooseZone?: () => void;
}

export function MainMenu(props: MainMenuProps) {
  const { onPlay, onOptions, onChooseZone } = props;
  // "Quitter" n'a de sens réel que pour un onglet ouvert PAR SCRIPT
  // (`window.open` depuis une autre page) — `window.close()` est un no-op
  // silencieux sinon (spec DOM). On tente quand même (gratuit, sans risque),
  // puis on bascule vers un message de repli honnête plutôt que de prétendre
  // que le bouton a fait quelque chose.
  const [showQuitFallback, setShowQuitFallback] = useState(false);

  function handleQuit() {
    window.close();
    setShowQuitFallback(true);
  }

  return (
    <div className="mm-root">
      <style>{MM_CSS}</style>
      <div className="mm-scanlines" />
      <div className="mm-vignette" />
      <div className="mm-rec">
        <span className="mm-dot" />
        SIGNAL INTERCEPTÉ
      </div>
      <div className="mm-timestamp">CAM_04 · RÉVEIL_DU_PEUPLE</div>

      <div className="mm-panel">
        <div className="mm-corner mm-corner-tl" />
        <div className="mm-corner mm-corner-tr" />
        <div className="mm-corner mm-corner-bl" />
        <div className="mm-corner mm-corner-br" />

        <div className="mm-title">
          PROJET<span className="mm-title-underscore">_</span>CASSANDRE
        </div>
        <div className="mm-subtitle">RÉVEIL_DU_PEUPLE — la vérité, en direct</div>

        {showQuitFallback ? (
          <div className="mm-fallback">
            ERREUR — cet onglet ne peut pas se fermer lui-même. Fermez-le
            manuellement pour couper la diffusion.
          </div>
        ) : (
          <div className="mm-buttons">
            <button className="mm-btn mm-btn-primary" onClick={onPlay}>
              <span className="mm-btn-icon">▶</span> REJOINDRE LE DIRECT
            </button>
            <button className="mm-btn" onClick={onOptions}>
              <span className="mm-btn-icon">▶</span> PARAMÈTRES DU SIGNAL
            </button>
            <button className="mm-btn mm-btn-danger" onClick={handleQuit}>
              <span className="mm-btn-icon">■</span> COUPER LA DIFFUSION
            </button>
          </div>
        )}

        {onChooseZone && (
          <button className="mm-devlink" onClick={onChooseZone}>
            [ACCÈS TECHNICIEN] choisir une zone
          </button>
        )}
      </div>

      <div className="mm-ticker">
        <div className="mm-ticker-track">
          SIGNAL NON AUTORISÉ&nbsp;&nbsp;·&nbsp;&nbsp;200 ABONNÉS&nbsp;&nbsp;·&nbsp;&nbsp;NE COUPEZ PAS LA
          DIFFUSION&nbsp;&nbsp;·&nbsp;&nbsp;ILS SURVEILLENT CE CANAL&nbsp;&nbsp;·&nbsp;&nbsp;SIGNAL NON
          AUTORISÉ&nbsp;&nbsp;·&nbsp;&nbsp;200 ABONNÉS&nbsp;&nbsp;·&nbsp;&nbsp;NE COUPEZ PAS LA
          DIFFUSION&nbsp;&nbsp;·&nbsp;&nbsp;ILS SURVEILLENT CE CANAL&nbsp;&nbsp;·&nbsp;&nbsp;
        </div>
      </div>
    </div>
  );
}

const MM_CSS = `
.mm-root {
  position: fixed;
  inset: 0;
  z-index: 1000;
  pointer-events: auto;
  background: radial-gradient(ellipse at 50% 40%, #0c130c 0%, #050705 70%, #020302 100%);
  color: #bfe8bf;
  font-family: "Courier New", ui-monospace, monospace;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.mm-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(120,255,140,0.05) 0px, rgba(120,255,140,0.05) 1px, transparent 2px, transparent 4px);
  mix-blend-mode: screen;
}
.mm-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.75) 100%);
}
.mm-rec {
  position: absolute;
  top: 18px;
  left: 22px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  letter-spacing: 2px;
  color: #f66;
  text-shadow: 0 0 6px rgba(255,60,60,0.6);
}
.mm-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f33;
  box-shadow: 0 0 8px #f33;
  animation: mm-blink 1.1s steps(1) infinite;
}
@keyframes mm-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.15; } }
.mm-timestamp {
  position: absolute;
  top: 18px;
  right: 22px;
  font-size: 11px;
  letter-spacing: 1.5px;
  color: #5a8a5a;
}
.mm-panel {
  position: relative;
  padding: 46px 58px 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  background: rgba(10, 18, 10, 0.55);
  border: 1px solid rgba(140, 255, 150, 0.25);
  box-shadow: 0 0 40px rgba(60, 220, 90, 0.08) inset;
}
.mm-corner {
  position: absolute;
  width: 22px;
  height: 22px;
  border: 2px solid #6f6;
  opacity: 0.85;
}
.mm-corner-tl { top: -2px; left: -2px; border-right: none; border-bottom: none; }
.mm-corner-tr { top: -2px; right: -2px; border-left: none; border-bottom: none; }
.mm-corner-bl { bottom: -2px; left: -2px; border-right: none; border-top: none; }
.mm-corner-br { bottom: -2px; right: -2px; border-left: none; border-top: none; }
.mm-title {
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 4px;
  color: #6bffa0;
  text-shadow: 0 0 12px rgba(90, 255, 140, 0.55), 2px 0 0 rgba(255,60,60,0.35), -2px 0 0 rgba(60,180,255,0.25);
}
.mm-title-underscore { animation: mm-cursor 1s steps(1) infinite; }
@keyframes mm-cursor { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
.mm-subtitle {
  margin-top: -10px;
  font-size: 12px;
  letter-spacing: 1.5px;
  color: #7fae7f;
}
.mm-buttons { display: flex; flex-direction: column; gap: 10px; min-width: 320px; margin-top: 6px; }
.mm-btn {
  position: relative;
  padding: 12px 18px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 2px;
  text-align: left;
  color: #bfe8bf;
  background: rgba(120, 255, 140, 0.05);
  border: 1px solid rgba(140, 255, 150, 0.35);
  cursor: pointer;
  transition: background 120ms linear, color 120ms linear, box-shadow 120ms linear;
}
.mm-btn:hover {
  color: #eafff0;
  background: rgba(120, 255, 140, 0.14);
  box-shadow: 0 0 18px rgba(90, 255, 140, 0.35) inset, 0 0 14px rgba(90,255,140,0.25);
}
.mm-btn-primary { border-color: #7fff9e; color: #eafff0; }
.mm-btn-danger:hover { color: #ffdada; background: rgba(255,80,80,0.12); box-shadow: 0 0 18px rgba(255,80,80,0.3) inset; }
.mm-btn-icon { display: inline-block; width: 18px; opacity: 0.85; }
.mm-devlink {
  margin-top: 4px;
  background: none;
  border: none;
  color: #446644;
  font-family: inherit;
  font-size: 10px;
  letter-spacing: 1px;
  text-decoration: underline;
  cursor: pointer;
}
.mm-fallback {
  max-width: 340px;
  min-width: 320px;
  font-size: 12px;
  line-height: 1.6;
  color: #ffb199;
  text-align: center;
  border: 1px solid rgba(255,120,90,0.4);
  background: rgba(60,10,10,0.35);
  padding: 14px 16px;
}
.mm-ticker {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 26px;
  background: rgba(120,255,140,0.08);
  border-top: 1px solid rgba(140,255,150,0.25);
  overflow: hidden;
  display: flex;
  align-items: center;
}
.mm-ticker-track {
  white-space: nowrap;
  font-size: 11px;
  letter-spacing: 1px;
  color: #7fae7f;
  animation: mm-scroll 22s linear infinite;
  padding-left: 100%;
}
@keyframes mm-scroll { from { transform: translateX(0); } to { transform: translateX(-100%); } }
`;
