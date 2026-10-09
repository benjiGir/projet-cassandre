import { playSfx } from "../../../core/audio/audio";
import { offerPrice, perkConfig } from "../../player/perkConfig";
import { PERK_INFO, type Perk, type PerkOffer } from "../../player/perks";
import { useGameStore } from "../../hud/state";
import type { UseObject } from "../../level/loading/levelTypes";
import { showHudMessage, triggerHeroLine } from "../player/feedback";
import { publishCounters } from "../stream/streamFeed";
import { spend } from "../stream/streamSim";
import { type GameSession } from "../gameSession";
import { kioskOffer, kioskConfig, type KioskOffer } from "../../player/kioskOffer";

// Les bornes : un `use_*` qui vend UN perk, payé avec les dons du direct. Ce
// module tient l'achat et pose l'effet du perk sur les objets de la partie —
// jamais sur une config globale : une nouvelle partie repart sans perk.

export type PerkPurchase = "achete" | "solde_insuffisant" | "epuisee";

/** L'achat lui-même, sans rien afficher : débite le solde et range le perk. */
export function buyPerk(session: Pick<GameSession, "perks" | "stream">, offer: PerkOffer): PerkPurchase {
  // Une borne ne vend son perk qu'une fois par partie.
  if (session.perks.has(offer.perk)) return "epuisee";
  if (!spend(session.stream, offerPrice(offer))) return "solde_insuffisant";
  session.perks.add(offer.perk);
  return "achete";
}

/** Ce qu'un perk touche : la partie, jamais `moveConfig`, `weaponConfig` ni `suitConfig`. */
export type PerkTarget = Pick<GameSession, "perks" | "playerHp" | "playerMaxHp" | "pickupRadius" | "heroPortrait"> & {
  weapons: Pick<GameSession["weapons"], "pistolMaxAmmoBonus" | "meleeDamageScale">;
  suitManager: Pick<GameSession["suitManager"], "sightRangeScale">;
};

/** Donne un perk sans passer par une borne (console de dev). Rend `false` s'il était déjà là. */
export function grantPerk(session: PerkTarget, perk: Perk): boolean {
  if (session.perks.has(perk)) return false;
  session.perks.add(perk);
  applyPerk(session, perk);
  return true;
}

/** Pose l'effet d'un perk sur la partie. Une seule fois par perk : le bonus du gilet s'ajoute. */
function applyPerk(session: PerkTarget, perk: Perk): void {
  switch (perk) {
    case "boisson":
      // Rien à poser : `startKillRush` lit la possession du perk à chaque kill.
      break;
    case "vpn":
      session.suitManager.sightRangeScale = perkConfig.vpnSightRangeScale;
      break;
    case "gilet":
      // Le gilet arrive plein : le bonus s'ajoute aux PV courants comme au maximum.
      session.playerMaxHp += perkConfig.giletMaxHpBonus;
      session.playerHp += perkConfig.giletMaxHpBonus;
      session.heroPortrait.heal(session.playerHp, session.playerMaxHp);
      useGameStore.getState().setDebug({ playerHp: session.playerHp, playerMaxHp: session.playerMaxHp });
      break;
    case "premium":
      session.weapons.pistolMaxAmmoBonus = perkConfig.premiumPistolAmmoBonus;
      break;
    case "perche":
      session.weapons.meleeDamageScale = perkConfig.percheMeleeDamageScale;
      break;
    case "aimant":
      session.pickupRadius = perkConfig.aimantPickupRadius;
      break;
    default:
      perk satisfies never;
  }
}

/** Un kill vient de tomber : la boisson relance la pointe de vitesse, sans la cumuler. */
export function startKillRush(session: Pick<GameSession, "perks" | "killRushRemaining">): void {
  if (session.perks.has("boisson")) session.killRushRemaining = perkConfig.boissonDuration;
}

/** Un pas fixe de la pointe de vitesse, à appeler AVANT le déplacement du joueur. */
export function updateKillRush(
  session: Pick<GameSession, "killRushRemaining"> & { player: Pick<GameSession["player"], "speedScale"> },
  dt: number,
): void {
  session.player.speedScale = session.killRushRemaining > 0 ? perkConfig.boissonSpeedScale : 1;
  session.killRushRemaining = Math.max(0, session.killRushRemaining - dt);
}

/** Appui sur la touche d'usage devant une borne. Rien ne fige le joueur (invariant #10). */
export function usePerkKiosk(session: GameSession, offer: PerkOffer): PerkPurchase {
  const resolved = kioskOffer(session.perks, offer);
  if (resolved.kind !== "perk") return useConsumable(session, resolved);
  const solde = session.stream.wallet;
  const prix = offerPrice(offer);
  const resultat = buyPerk(session, offer);
  switch (resultat) {
    case "achete":
      applyPerk(session, offer.perk);
      publishCounters(session.stream);
      showHudMessage(`${PERK_INFO[offer.perk].label} : −${prix} €`);
      session.heroPortrait.react("victory", 1);
      playSfx("ammo_pickup");
      triggerHeroLine(session, `pub_${offer.perk}`);
      break;
    case "solde_insuffisant":
      showHudMessage(`Solde insuffisant : il manque ${prix - solde} €`);
      triggerHeroLine(session, "borne_solde");
      break;
    case "epuisee":
      showHudMessage("Borne épuisée");
      break;
    default:
      return resultat satisfies never;
  }
  return resultat;
}

type KioskTarget = Pick<GameSession, "perks" | "playerHp" | "playerMaxHp" | "weapons">;

function consumableUseful(session: KioskTarget, kind: KioskOffer["kind"]): boolean {
  if (kind === "heal") return session.playerHp < session.playerMaxHp;
  if (kind === "ammo") return (session.weapons.owns("pistol") && session.weapons.pistolAmmo < session.weapons.pistolMaxAmmo)
    || (session.weapons.owns("shotgun") && session.weapons.shotgunAmmo < session.weapons.shotgunMaxAmmo);
  return true;
}

function useConsumable(session: GameSession, offer: KioskOffer): PerkPurchase {
  if (!consumableUseful(session, offer.kind)) {
    showHudMessage(offer.kind === "heal" ? "Santé déjà au maximum" : "Aucune arme à recharger");
    return "epuisee";
  }
  if (!spend(session.stream, offer.price)) {
    showHudMessage(`Solde insuffisant : il manque ${offer.price - session.stream.wallet} €`);
    triggerHeroLine(session, "borne_solde");
    return "solde_insuffisant";
  }
  if (offer.kind === "heal") {
    session.playerHp = Math.min(session.playerMaxHp, session.playerHp + kioskConfig.healHp);
    session.heroPortrait.heal(session.playerHp, session.playerMaxHp);
    useGameStore.getState().setPlayerHp(session.playerHp);
  } else {
    if (session.weapons.owns("pistol")) session.weapons.addPistolAmmo(kioskConfig.pistolAmmo);
    if (session.weapons.owns("shotgun")) session.weapons.addShotgunAmmo(kioskConfig.shotgunAmmo);
  }
  publishCounters(session.stream);
  showHudMessage(`${offer.label} : −${offer.price} €`);
  playSfx("ammo_pickup");
  return "achete";
}

/**
 * Tient l'invite du HUD à jour : l'offre de la borne que viserait la touche
 * d'usage. Appelé à chaque pas fixe, n'écrit dans le store que sur un changement.
 */
export function publishPerkOffer(session: KioskTarget, nearest: UseObject | null, key: string): void {
  const store = useGameStore.getState();
  const affichee = store.perkOffer;
  const offer = nearest?.sells ?? null;
  if (!offer) {
    if (affichee) store.setPerkOffer(null);
    return;
  }
  const { label, effect, price, kind } = kioskOffer(session.perks, offer);
  const sold = !consumableUseful(session, kind);
  if (affichee && affichee.key === key && affichee.label === label && affichee.effect === effect && affichee.price === price
    && affichee.sold === sold) return;
  store.setPerkOffer({ key, label, effect, price, sold });
}
