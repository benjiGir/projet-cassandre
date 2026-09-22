import { useGameStore } from "../game/state";
import { vpx } from "./hudScale";

/**
 * Réplique du héros — canal dédié (`state.heroLine`), distinct du canal
 * système `HudMessage`. Purement présentationnel : lit le store, n'écrit
 * jamais dedans ; l'auto-effacement et le cooldown vivent côté appelant.
 * Positionné comme une légende de stream sous la webcam factice de
 * `Hud.tsx` — c'est le héros qui commente sa propre vidéo.
 * see: docs/systems/hud.md#deux-canaux-de-message-hudmessage-et-heroline
 */
export function HeroLine() {
  const line = useGameStore((s) => s.heroLine);
  if (!line) return null;

  return (
    <>
      <style>{HL_CSS}</style>
      <div className="hl-box">
        <span className="hl-tag">RÉVEIL_DU_PEUPLE dit :</span>
        {line}
      </div>
    </>
  );
}

const HL_CSS = `
.hl-box {
  position: fixed;
  /* Sous le bloc webcam + spectateurs de Hud.tsx (~65vpx de haut, calé sur
     les mêmes vpx(...) — voir la passe de réduction du 2026-09-22 dans
     Hud.tsx) : une valeur en dur, mais dans le même espace de pixels
     virtuels que ce bloc, donc qui reste sous lui à toute résolution 16:9.
     max-width élargi (150 -> 220vpx) et police réduite (15 -> 10) : c'est le
     nombre de lignes que le texte wrap qui pilotait le plus la hauteur de
     cette bulle, pas seulement la taille de police — mesuré en DOM, cette
     bulle occupait à elle seule 30,7 % de la hauteur d'écran avant cette
     passe (une phrase de démo sur 4 lignes), 12,6 % après (2 lignes). */
  top: ${vpx(72)};
  right: ${vpx(5)};
  max-width: ${vpx(220)};
  color: #ffe27a;
  font-family: "Courier New", ui-monospace, monospace;
  font-size: ${vpx(10)};
  line-height: 1.3;
  text-shadow: 1px 1px 2px #000;
  background: rgba(20, 15, 0, 0.6);
  border: ${vpx(1)} solid rgba(255, 226, 122, 0.4);
  padding: ${vpx(3)} ${vpx(5)};
  pointer-events: none;
  user-select: none;
}
.hl-tag { opacity: 0.75; font-size: ${vpx(8)}; display: block; margin-bottom: ${vpx(1)}; letter-spacing: 0.5px; }
`;
