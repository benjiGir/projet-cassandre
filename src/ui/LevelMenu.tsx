import { useState } from "react";

/**
 * Écran de choix de niveau affiché AU BOOT, avant `startLoop`. Utilitaire de
 * développement (Phase 5, choix de zone) — pas le menu principal de la
 * Phase 6 (Jouer/Quitter).
 *
 * PUREMENT PRÉSENTATIONNEL : aucun import `src/game/*`, aucun accès au store
 * zustand. `main.ts` le monte avant même de construire la scène Three.js/le
 * monde Rapier — ce composant ne doit rien connaître du jeu, tout arrive par
 * props (invariant #2 : React ne touche jamais la boucle, et ici la boucle
 * n'existe même pas encore).
 */

export interface LevelMenuOption {
  id: string;
  label: string;
}

export interface LevelMenuProps {
  options: LevelMenuOption[];
  onChoose: (id: string) => void;
  title?: string;
}

const DEFAULT_TITLE = "PROJET_CASSANDRE";

export function LevelMenu(props: LevelMenuProps) {
  const { options, onChoose, title } = props;
  // Détail d'UI mineur (surbrillance au survol/focus) — aucune logique de
  // jeu, aucune boucle, rien qui tourne à 60 Hz.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
      <div
        style={{
          fontSize: 28,
          fontWeight: "bold",
          color: "#0f0",
          letterSpacing: 2,
        }}
      >
        {title ?? DEFAULT_TITLE}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minWidth: 260,
        }}
      >
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onChoose(option.id)}
            onMouseEnter={() => setHoveredId(option.id)}
            onMouseLeave={() => setHoveredId((current) => (current === option.id ? null : current))}
            style={{
              padding: "10px 16px",
              fontFamily: "monospace",
              fontSize: 15,
              color: hoveredId === option.id ? "#0f0" : "#ddd",
              background: hoveredId === option.id ? "rgba(0, 255, 0, 0.1)" : "rgba(255, 255, 255, 0.04)",
              border: "1px solid #444",
              cursor: "pointer",
              pointerEvents: "auto",
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
