import { useEffect, useState } from "react";

import {
  ACTION_LABELS,
  ALL_ACTIONS,
  DEFAULT_BINDINGS,
  formatKeyCode,
  input,
  type GameAction,
} from "../core/input";

/**
 * Écran de rebinding (Phase 6, plan section G) — consomme l'API de rebinding
 * livrée par `core-loop` dans `src/core/input.ts` (voir sa doc de tête :
 * `getAllBindings`/`rebind`/`resetBindings`/`formatKeyCode`, déjà vérifiée
 * par build + tests headless, NON RETOUCHÉE ici).
 *
 * Accessible UNIQUEMENT depuis le menu principal (`MainMenu`, "Options"),
 * donc TOUJOURS avant `input.attach(canvas)` dans `main.ts` (le menu
 * principal s'affiche avant tout boot de jeu, voir `resolveBootChoice`) —
 * import direct de `input` sûr malgré ça : `getAllBindings`/`rebind`/
 * `resetBindings` ne touchent jamais `this.canvas`, seuls des listeners
 * `window` temporaires posés par CE composant (voir plus bas) captent la
 * touche suivante. Pas de pause en jeu dans ce slice (hors scope : le plan
 * ne demande qu'une accessibilité depuis le menu principal, pas un menu
 * pause complet — invariant retro-fps « pas de sur-ingénierie »).
 *
 * `input.getAllBindings()` N'EST PAS RÉACTIF (ce n'est pas du zustand) :
 * l'état local `bindings` ci-dessous est une COPIE, resynchronisée
 * explicitement après chaque rebind/reset — même philosophie que
 * `TuningPanel.tsx` (« l'état React local n'est resynchronisé qu'à
 * l'interaction humaine, jamais en tâche de fond »).
 */

export interface RebindScreenProps {
  onBack: () => void;
}

export function RebindScreen(props: RebindScreenProps) {
  const { onBack } = props;
  const [bindings, setBindings] = useState<Record<GameAction, string>>(() => input.getAllBindings());
  const [listeningFor, setListeningFor] = useState<GameAction | null>(null);

  // Capture LA PROCHAINE touche/bouton une fois qu'un rebind est demandé.
  // Attaché/détaché via `listeningFor` : rien n'écoute tant qu'aucun rebind
  // n'est en cours (pas de coût, pas de conflit avec d'éventuels autres
  // listeners `window` — voir la doc de tête pour pourquoi c'est sûr ici).
  useEffect(() => {
    if (!listeningFor) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === "Escape") {
        // Échap ANNULE la capture, ne rebind jamais vers "Escape" lui-même
        // (garderait le joueur sans moyen évident de sortir d'un rebind raté).
        setListeningFor(null);
        return;
      }
      // `e.code` vide : jamais produit par un vrai clavier physique, mais
      // certains événements synthétiques (outils d'accessibilité,
      // automatisation) peuvent en émettre un. Sans cette garde, un rebind
      // vers "" corromprait silencieusement l'action (plus aucune touche ne
      // la déclenche, `formatKeyCode("")` affiche un bouton vide) jusqu'à ce
      // que le joueur pense à "Réinitialiser".
      if (!e.code) return;
      input.rebind(listeningFor, e.code);
      setBindings(input.getAllBindings());
      setListeningFor(null);
    };

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      const code = e.button === 0 ? "Mouse0" : e.button === 2 ? "Mouse2" : null;
      if (!code) return; // clic milieu/latéral ignoré — pas de code stable dans `formatKeyCode`
      input.rebind(listeningFor, code);
      setBindings(input.getAllBindings());
      setListeningFor(null);
    };

    // `contextmenu` : un rebind vers le clic droit ne doit pas non plus
    // ouvrir le menu contextuel du navigateur pendant la capture.
    const onContextMenu = (e: Event) => e.preventDefault();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, [listeningFor]);

  function handleReset() {
    input.resetBindings();
    setBindings(input.getAllBindings());
    setListeningFor(null);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        background: "#0a0a0a",
        color: "#ddd",
        fontFamily: "monospace",
        pointerEvents: "auto",
        zIndex: 1000,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: "bold", color: "#0f0", letterSpacing: 2 }}>TOUCHES</div>
      <div style={{ fontSize: 11, color: "#888", maxWidth: 360, textAlign: "center" }}>
        AZERTY (ZQSD) fonctionne déjà par défaut — ceci sert à remapper au-delà,
        pour un autre agencement ou une préférence personnelle. Échap annule une
        capture en cours.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto auto",
          columnGap: 24,
          rowGap: 8,
          minWidth: 340,
        }}
      >
        {ALL_ACTIONS.map((action) => {
          const isListening = listeningFor === action;
          const isDefault = bindings[action] === DEFAULT_BINDINGS[action];
          return (
            <div key={action} style={{ display: "contents" }}>
              <div style={{ fontSize: 13, alignSelf: "center" }}>{ACTION_LABELS[action]}</div>
              <button
                onClick={() => setListeningFor(action)}
                style={{
                  padding: "4px 12px",
                  minWidth: 130,
                  fontFamily: "monospace",
                  fontSize: 13,
                  color: isListening ? "#000" : isDefault ? "#ddd" : "#ffd54a",
                  background: isListening ? "#0f0" : "rgba(255, 255, 255, 0.04)",
                  border: `1px solid ${isListening ? "#0f0" : "#444"}`,
                  cursor: "pointer",
                  pointerEvents: "auto",
                }}
              >
                {isListening ? "Appuyez sur une touche…" : formatKeyCode(bindings[action])}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button
          onClick={handleReset}
          style={{
            padding: "8px 16px",
            fontFamily: "monospace",
            fontSize: 13,
            color: "#ddd",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid #444",
            cursor: "pointer",
            pointerEvents: "auto",
          }}
        >
          Réinitialiser
        </button>
        <button
          onClick={onBack}
          style={{
            padding: "8px 16px",
            fontFamily: "monospace",
            fontSize: 13,
            color: "#0f0",
            background: "rgba(0, 255, 0, 0.08)",
            border: "1px solid #4a4",
            cursor: "pointer",
            pointerEvents: "auto",
          }}
        >
          Retour
        </button>
      </div>
    </div>
  );
}
