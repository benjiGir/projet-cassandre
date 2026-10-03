import { AmmoPanel } from "../widgets/AmmoPanel/AmmoPanel";
import { DonationAlert } from "../widgets/DonationAlert/DonationAlert";
import { HealthPanel } from "../widgets/HealthPanel/HealthPanel";
import { HeroLine } from "../widgets/HeroLine/HeroLine";
import { HudCorner } from "../primitives/HudCorner/HudCorner";
import { LiveCam } from "../widgets/LiveCam/LiveCam";
import { LoyaltyCards } from "../widgets/LoyaltyCards/LoyaltyCards";
import { StreamChat } from "../widgets/StreamChat/StreamChat";
import { ViewerCount } from "../widgets/ViewerCount/ViewerCount";
import { Wallet } from "../widgets/Wallet/Wallet";

// see: docs/archive/systems-hud.md#hud-de-production
export function Hud() {
  return (
    <>
      <HudCorner position="topRight">
        <LiveCam />
        <ViewerCount />
        <Wallet />
        <HeroLine />
      </HudCorner>
      <HudCorner position="bottomLeft">
        <DonationAlert />
        <StreamChat />
        <LoyaltyCards />
        <HealthPanel />
      </HudCorner>
      <HudCorner position="bottomRight">
        <AmmoPanel />
      </HudCorner>
    </>
  );
}
