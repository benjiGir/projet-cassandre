import { AmmoPanel } from "../widgets/AmmoPanel/AmmoPanel";
import { HealthPanel } from "../widgets/HealthPanel/HealthPanel";
import { HeroLine } from "../widgets/HeroLine/HeroLine";
import { HudCorner } from "../primitives/HudCorner/HudCorner";
import { LiveCam } from "../widgets/LiveCam/LiveCam";
import { LoyaltyCards } from "../widgets/LoyaltyCards/LoyaltyCards";
import { ViewerCount } from "../widgets/ViewerCount/ViewerCount";

/**
 * HUD de production : l'overlay de stream du héros, pas un HUD de FPS
 * classique. Ne lit rien du store — il place des widgets, et chacun lit ce
 * qu'il affiche (invariant #2 : seul le widget concerné re-rend).
 * see: docs/systems/hud.md#hud-de-production
 * see: docs/reference/react-composition.md#chaque-feuille-lit-ses-propres-données
 */
export function Hud() {
  return (
    <>
      <HudCorner position="topRight">
        <LiveCam />
        <ViewerCount />
        <HeroLine />
      </HudCorner>
      <HudCorner position="bottomLeft">
        <LoyaltyCards />
        <HealthPanel />
      </HudCorner>
      <HudCorner position="bottomRight">
        <AmmoPanel />
      </HudCorner>
    </>
  );
}
