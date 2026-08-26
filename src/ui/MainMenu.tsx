import { useState, type CSSProperties } from "react";

/**
 * Menu principal minimal (Phase 6, plan section F) — "Jouer" / "Options" /
 * "Quitter". DISTINCT de `LevelMenu.tsx` (outil de DEV pour choisir une zone
 * individuelle, voir son en-tête) : les deux ne sont PAS fusionnés.
 *
 * RELATION AVEC `LevelMenu` (décision explicite, voir `main.ts::resolveBootChoice`
 * pour le câblage exact) : "Jouer" mène DIRECTEMENT au niveau complet
 * (`hypermarche_complet`, sans passer par `LevelMenu`) — c'est le chemin
 * joueur normal. `LevelMenu` (choix de zone individuelle) reste accessible
 * UNIQUEMENT via le lien discret "Choisir une zone (dev)" tout en bas de cet
 * écran, qui délègue à `resolveLevelChoice` (la fonction pré-existante,
 * inchangée) — c'est le même composant `LevelMenu.tsx` que celui utilisé
 * historiquement, jamais dupliqué. Les raccourcis `?level=<id>` continuent
 * de bypasser CE menu entièrement (voir `resolveBootChoice`) : ce composant
 * ne s'affiche que si l'URL n'a PAS de paramètre `level`.
 *
 * PUREMENT PRÉSENTATIONNEL, comme `LevelMenu.tsx` : aucun import `src/game/*`,
 * tout arrive par props. Affiché AVANT que la boucle de jeu existe.
 */

export interface MainMenuProps {
  onPlay: () => void;
  onOptions: () => void;
  /** Lien discret vers `LevelMenu` (choix de zone, outil de dev) — voir la doc de tête. */
  onChooseZone: () => void;
}

const BUTTON_BASE_STYLE: CSSProperties = {
  padding: "10px 16px",
  fontFamily: "monospace",
  fontSize: 15,
  border: "1px solid #444",
  cursor: "pointer",
  pointerEvents: "auto",
};

export function MainMenu(props: MainMenuProps) {
  const { onPlay, onOptions, onChooseZone } = props;
  const [hoveredId, setHoveredId] = useState<string | null>(null);
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

  const buttonStyle = (id: string): CSSProperties => ({
    ...BUTTON_BASE_STYLE,
    color: hoveredId === id ? "#0f0" : "#ddd",
    background: hoveredId === id ? "rgba(0, 255, 0, 0.1)" : "rgba(255, 255, 255, 0.04)",
  });

  const hoverHandlers = (id: string) => ({
    onMouseEnter: () => setHoveredId(id),
    onMouseLeave: () => setHoveredId((current) => (current === id ? null : current)),
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        background: "#0a0a0a",
        color: "#ddd",
        fontFamily: "monospace",
        pointerEvents: "auto",
        zIndex: 1000,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: "bold", color: "#0f0", letterSpacing: 2 }}>PROJET_CASSANDRE</div>
      <div style={{ fontSize: 12, color: "#888", marginTop: -16 }}>RÉVEIL_DU_PEUPLE — la vérité, en direct</div>

      {showQuitFallback ? (
        <div style={{ fontSize: 13, color: "#fa3", textAlign: "center", maxWidth: 320 }}>
          Ceci est un onglet de navigateur : il ne peut pas se fermer tout
          seul. Vous pouvez fermer cet onglet manuellement.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 260 }}>
          <button onClick={onPlay} style={buttonStyle("play")} {...hoverHandlers("play")}>
            Jouer
          </button>
          <button onClick={onOptions} style={buttonStyle("options")} {...hoverHandlers("options")}>
            Options (touches)
          </button>
          <button onClick={handleQuit} style={buttonStyle("quit")} {...hoverHandlers("quit")}>
            Quitter
          </button>
        </div>
      )}

      <button
        onClick={onChooseZone}
        style={{
          marginTop: 8,
          background: "none",
          border: "none",
          color: "#555",
          fontFamily: "monospace",
          fontSize: 11,
          textDecoration: "underline",
          cursor: "pointer",
          pointerEvents: "auto",
        }}
      >
        Choisir une zone (dev)
      </button>
    </div>
  );
}
