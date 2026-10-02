import { AmmoPanel } from "../widgets/AmmoPanel/AmmoPanel";
import { HealthPanel } from "../widgets/HealthPanel/HealthPanel";
import { HeroLine } from "../widgets/HeroLine/HeroLine";
import { HudCorner } from "../primitives/HudCorner/HudCorner";
import { LiveCam } from "../widgets/LiveCam/LiveCam";
import { LoyaltyCards } from "../widgets/LoyaltyCards/LoyaltyCards";
import { ViewerCount } from "../widgets/ViewerCount/ViewerCount";

// see: docs/archive/systems-hud.md#hud-de-production
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
