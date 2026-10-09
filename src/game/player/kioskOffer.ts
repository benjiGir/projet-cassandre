import { offerPrice } from "./perkConfig";
import { PERK_INFO, type Perk, type PerkOffer } from "./perks";

export const kioskConfig = { healPrice: 10, healHp: 25, ammoPrice: 12, pistolAmmo: 24, shotgunAmmo: 8 };

export interface KioskOffer {
  readonly kind: "perk" | "heal" | "ammo";
  readonly label: string;
  readonly effect: string;
  readonly price: number;
}

export function kioskOffer(perks: ReadonlySet<Perk>, offer: PerkOffer): KioskOffer {
  if (!perks.has(offer.perk)) return { kind: "perk", ...PERK_INFO[offer.perk], price: offerPrice(offer) };
  if (offer.perk === "boisson" || offer.perk === "gilet" || offer.perk === "vpn") {
    return {
      kind: "heal",
      label: "Trousse de soins",
      effect: `jusqu’à +${kioskConfig.healHp} PV`,
      price: kioskConfig.healPrice,
    };
  }
  return {
    kind: "ammo",
    label: "Recharge de munitions",
    effect: `+${kioskConfig.pistolAmmo} balles / +${kioskConfig.shotgunAmmo} cartouches (armes possédées)`,
    price: kioskConfig.ammoPrice,
  };
}
