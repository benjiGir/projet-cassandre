import { playSfx } from "../../../core/audio/audio";
import { useGameStore } from "../../hud/state";
import type { InteractionSystem, PickupAccessCheck } from "../../level/interactions/interactive";
import type { UseObject } from "../../level/loading/levelTypes";
import type { GameSession } from "../gameSession";
import type { RunState } from "../runState";
import { FOOD_LINES, type HeroLineId } from "../presentation/heroLines";
import { showHudMessage, triggerHeroLine } from "./feedback";

/** Boîtes de munitions qui ont leur propre réplique : une cache trouvée, pas un ramassage ordinaire. */
const AMMO_CACHE_LINES: Readonly<Record<string, HeroLineId>> = { use_munitions_gaine_1: "cache_gaine" };
/** À partir de ce contenu, une boîte de munitions est une grande boîte : elle a sa réplique. */
const LARGE_AMMO_BOX = 36;

type HealTarget = Pick<GameSession, "heroPortrait"> & { run: Pick<RunState, "playerHp" | "playerMaxHp"> };

/** Rend des PV au joueur, plafonnés à son maximum, et le montre (portrait, HUD). Rend les PV réellement gagnés. */
export function healPlayer(session: HealTarget, amount: number): number {
  const { run } = session;
  const before = run.playerHp;
  run.playerHp = Math.min(run.playerMaxHp, before + amount);
  session.heroPortrait.heal(run.playerHp, run.playerMaxHp);
  useGameStore.getState().setPlayerHp(run.playerHp);
  return run.playerHp - before;
}

// Une boîte ramassée au plafond de munitions ne donnerait rien : elle reste
// au sol, comme une trousse sur un joueur en pleine forme.
function takeAmmoBox(session: GameSession, amount: number, useObject: UseObject): boolean {
  const weapon = useObject.ammoWeapon ?? "pistol";
  const taken =
    weapon === "flare"
      ? session.weapons.addFlareAmmo(amount)
      : weapon === "shotgun"
        ? session.weapons.addShotgunAmmo(amount)
        : session.weapons.addPistolAmmo(amount);
  if (taken <= 0) return false;
  showHudMessage(
    weapon === "flare"
      ? `+${taken} fusées de détresse`
      : weapon === "shotgun"
        ? `+${taken} cartouches de pompe`
        : `+${taken} munitions`,
  );
  session.heroPortrait.react("victory", 0.45);
  playSfx("ammo_pickup");
  if (weapon === "pistol")
    triggerHeroLine(
      session,
      AMMO_CACHE_LINES[useObject.name] ?? (amount >= LARGE_AMMO_BOX ? "munitions_36" : "munitions_24"),
    );
  return true;
}

function takeNewWeapon(session: GameSession, taken: boolean, message: string, line: HeroLineId): boolean {
  if (taken) {
    showHudMessage(message);
    session.heroPortrait.react("victory", 1);
    playSfx("ammo_pickup");
    triggerHeroLine(session, line);
  } else {
    triggerHeroLine(session, "arme_double");
  }
  return taken;
}

function takePistol(session: GameSession): boolean {
  // Lus AVANT `tryCollectPistol()` : après coup, `true` ne dit plus si
  // c'était la première arme ou une simple recharge.
  const alreadyOwned = session.weapons.hasPistolAlready;
  const ammoBefore = session.weapons.pistolAmmo;
  const taken = session.weapons.tryCollectPistol();
  if (taken) {
    session.heroPortrait.react("victory", alreadyOwned ? 0.45 : 1);
    showHudMessage(alreadyOwned ? `+${session.weapons.pistolAmmo - ammoBefore} munitions` : "Pistolet récupéré");
    playSfx("ammo_pickup");
    if (!alreadyOwned) triggerHeroLine(session, "arme_pistolet");
  }
  return taken;
}

function takeFlare(session: GameSession): boolean {
  // Lus AVANT `tryCollectFlare()`, comme pour le pistolet juste au-dessus.
  const alreadyOwned = session.weapons.hasFlareAlready;
  const ammoBefore = session.weapons.flareAmmo;
  const taken = session.weapons.tryCollectFlare();
  if (taken) {
    session.heroPortrait.react("victory", alreadyOwned ? 0.45 : 1);
    showHudMessage(
      alreadyOwned ? `+${session.weapons.flareAmmo - ammoBefore} fusées de détresse` : "Pistolet de détresse récupéré",
    );
    playSfx("ammo_pickup");
    if (!alreadyOwned) triggerHeroLine(session, "arme_fusee");
  }
  return taken;
}

function takeHeal(session: GameSession, amount: number, useObject: UseObject): boolean {
  if (session.run.playerHp >= session.run.playerMaxHp) {
    // Laissée au sol pour plus tard. La réplique est `once` : elle ne se
    // répète pas à chaque pas fixe passé debout sur la trousse.
    if (!useObject.aliment) triggerHeroLine(session, "soin_plein");
    return false;
  }
  showHudMessage(`+${healPlayer(session, amount)} PV`);
  // Un aliment a son propre son, jamais le carillon de trousse de soin.
  playSfx(useObject.aliment ? "food_eat" : "heal_pickup");
  const line = useObject.aliment ? FOOD_LINES[useObject.aliment] : undefined;
  if (line) triggerHeroLine(session, line);
  return true;
}

function eatFoodDrop(session: GameSession, amount: number): boolean {
  if (session.run.playerHp >= session.run.playerMaxHp) return false;
  showHudMessage(`+${healPlayer(session, amount)} PV`);
  playSfx("food_eat");
  return true;
}

/**
 * Un pas fixe des ramassages pris en marchant dessus, sans touche : boîtes de
 * munitions, armes au sol, trousses et aliments, puis la nourriture lâchée par
 * un prop cassé. Un ramassage qui n'apporterait rien reste au sol.
 */
export function updatePickups(
  interaction: InteractionSystem,
  session: GameSession,
  canCollect: PickupAccessCheck,
): void {
  const useObjects = session.gltfLevelSession?.current?.useObjects ?? [];
  const position = session.player.position;
  const radius = session.run.pickupRadius;

  interaction.collectAmmo(
    useObjects,
    position,
    (amount, useObject) => takeAmmoBox(session, amount, useObject),
    radius,
    canCollect,
  );
  interaction.collectWeapons(
    useObjects,
    position,
    {
      onCrowbarPickup: () =>
        takeNewWeapon(session, session.weapons.tryCollectMelee(), "Pied-de-biche récupéré", "arme_pied_biche"),
      onShotgunPickup: () =>
        takeNewWeapon(session, session.weapons.tryCollectShotgun(), "Fusil à pompe récupéré", "arme_pompe"),
      onPistolPickup: () => takePistol(session),
      onFlarePickup: () => takeFlare(session),
    },
    radius,
    canCollect,
  );
  interaction.collectHeals(
    useObjects,
    position,
    (amount, useObject) => takeHeal(session, amount, useObject),
    radius,
    canCollect,
  );
  session.level.propSystem?.collectFoodDrops(position, (amount) => eatFoodDrop(session, amount), radius);
}
