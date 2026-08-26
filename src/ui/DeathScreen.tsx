import { useGameStore } from "../game/state";
import { reloadSamePage, reloadToMainMenu } from "./screenNav";

/**
 * Écran de mort plein cadre (Phase 6). Purement présentationnel : lit
 * `state.isDead` (écrit UNE FOIS par `main.ts`, voir sa doc dans
 * `game/state.ts`) et retourne `null` tant qu'il est faux — même pattern que
 * `HudMessage.tsx`. Aucune logique de jeu ici : l'arrêt réel du gameplay
 * (dégâts/tir/interactions qui ne font plus rien) est une garde dans
 * `main.ts::updateGameplay`, pas un effet de ce composant.
 *
 * Boutons "Rejouer"/"Retour au menu principal" : voir `screenNav.ts` pour la
 * décision (rechargement de page complet, pas de reset en place).
 */
export function DeathScreen() {
  const isDead = useGameStore((s) => s.isDead);
  const views = useGameStore((s) => s.debug.views);
  if (!isDead) return null;

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
          onClick={reloadSamePage}
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
          onClick={reloadToMainMenu}
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
