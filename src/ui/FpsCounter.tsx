import { useGameStore } from "../game/state";
import { vpx } from "./hudScale";

/**
 * Seul chiffre du panneau de debug qui a sa place devant le joueur : le
 * build de production le monte à la place de `DebugPanel`, au même coin.
 * Sélecteur arrondi à l'entier — la moyenne lissée bouge à chaque écriture
 * (10 Hz), l'affichage seulement quand le nombre lu change.
 *
 * Pas de variante `?ui=` — il n'en a jamais eu — mais dimensionné en
 * pixels virtuels comme le reste du HUD (`hudScale.ts`) : un dernier
 * élément resté en `px` fixe aurait paru orphelin une fois tout le reste
 * remis à l'échelle. Reste volontairement discret (petit, coin isolé).
 * see: docs/systems/hud.md#composition-de-app
 */
export function FpsCounter() {
  const fps = useGameStore((state) => Math.round(state.debug.fps));

  return (
    <div
      style={{
        position: "fixed",
        top: vpx(3),
        left: vpx(3),
        padding: `${vpx(1)} ${vpx(2)}`,
        background: "rgba(0, 0, 0, 0.5)",
        color: "#ddd",
        fontFamily: "monospace",
        fontSize: vpx(4),
        pointerEvents: "none",
        whiteSpace: "pre",
      }}
    >
      {`${String(fps).padStart(3, " ")} FPS`}
    </div>
  );
}
