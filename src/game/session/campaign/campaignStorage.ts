import { Schema } from "effect";
import { PERKS } from "../../player/perks";
import { DIFFICULTIES } from "../progression/difficulty";
import { perkConfig } from "../../player/perkConfig";
import { INITIAL_PLAYER_MAX_HP } from "../player/playerState";
import { weaponConfig } from "../../player/weapons/weaponConfig";
import { useGameStore } from "../../hud/state";
import { freezeArrival } from "./campaignArrival";
import type { CampaignArrival } from "./campaignTypes";

const STORAGE_KEY = "cassandre.campaign.v1";
const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const ArrivalSchema = Schema.Struct({
  weapons: Schema.Struct({
    owned: Schema.Array(Schema.Literals(["melee", "pistol", "shotgun"])).check(Schema.isUnique()),
    active: Schema.Literals(["none", "melee", "pistol", "shotgun"]),
    pistolAmmo: Count,
    shotgunAmmo: Count,
  }),
  perks: Schema.Array(Schema.Literals(PERKS)).check(Schema.isUnique()),
  wallet: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  hp: Schema.Finite.check(Schema.isGreaterThan(0)),
  difficulty: Schema.Literals(DIFFICULTIES),
}).check(
  Schema.makeFilter(
    (arrival) =>
      (arrival.weapons.active === "none" || arrival.weapons.owned.includes(arrival.weapons.active)) &&
      arrival.hp <= INITIAL_PLAYER_MAX_HP + (arrival.perks.includes("gilet") ? perkConfig.giletMaxHpBonus : 0) &&
      arrival.weapons.pistolAmmo <=
        weaponConfig.pistolMaxAmmo + (arrival.perks.includes("premium") ? perkConfig.premiumPistolAmmoBonus : 0) &&
      arrival.weapons.shotgunAmmo <= weaponConfig.shotgunMaxAmmo,
    { expected: "un équipement cohérent et des PV compatibles avec les perks" },
  ),
);
const SaveSchema = Schema.Struct({ version: Schema.Literal(1), arrival: ArrivalSchema });

let current: CampaignArrival | null = null;
let pending: CampaignArrival | null = null;
let loaded = false;
let persistenceFailed = false;

export function campaignArrival(): CampaignArrival | null {
  if (loaded) return current;
  loaded = true;
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw) current = freezeArrival(Schema.decodeUnknownSync(SaveSchema)(JSON.parse(raw)).arrival);
  } catch (error) {
    console.warn("[campagne] Sauvegarde indisponible ou illisible", error);
  }
  return current;
}

export function queueCampaignSave(arrival: CampaignArrival): void {
  loaded = true;
  current = pending = freezeArrival(arrival);
}

// see: docs/4-technique/campagne.md#persistance
export function flushCampaignSave(): void {
  if (!pending) return;
  const arrival = pending;
  pending = null;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, arrival }));
    persistenceFailed = false;
  } catch (error) {
    persistenceFailed = true;
    console.warn("[campagne] Reprise disponible dans cet onglet seulement", error);
    useGameStore.getState().showHudMessage("Sauvegarde indisponible : la reprise sera perdue en fermant cet onglet.");
  }
}

export function campaignPersistenceFailed(): boolean {
  return persistenceFailed;
}
