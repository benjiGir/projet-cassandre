import { useGameStore } from "../game/state";

/**
 * Seul chiffre du panneau de debug qui a sa place devant le joueur : le
 * build de production le monte à la place de `DebugPanel`, au même coin.
 * Sélecteur arrondi à l'entier — la moyenne lissée bouge à chaque écriture
 * (10 Hz), l'affichage seulement quand le nombre lu change.
 * see: docs/systems/hud.md#composition-de-app
 */
export function FpsCounter() {
  const fps = useGameStore((state) => Math.round(state.debug.fps));

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        padding: "2px 6px",
        background: "rgba(0, 0, 0, 0.5)",
        color: "#ddd",
        fontFamily: "monospace",
        fontSize: 12,
        pointerEvents: "none",
        whiteSpace: "pre",
      }}
    >
      {`${String(fps).padStart(3, " ")} FPS`}
    </div>
  );
}
