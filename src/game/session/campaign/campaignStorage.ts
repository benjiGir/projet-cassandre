import { Schema } from "effect";
import { persisted } from "../../../core/storage/persisted";
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
    owned: Schema.Array(Schema.Literals(["melee", "pistol", "shotgun", "flare"])).check(Schema.isUnique()),
    active: Schema.Literals(["none", "melee", "pistol", "shotgun", "flare"]),
    pistolAmmo: Count,
    shotgunAmmo: Count,
    // Absent d'une sauvegarde antérieure au pistolet de détresse.
    flareAmmo: Schema.optionalKey(Count),
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
      arrival.weapons.shotgunAmmo <= weaponConfig.shotgunMaxAmmo &&
      (arrival.weapons.flareAmmo ?? 0) <= weaponConfig.flareMaxAmmo,
    { expected: "un équipement cohérent et des PV compatibles avec les perks" },
  ),
);
const SaveSchema = Schema.Struct({ version: Schema.Literal(1), arrival: ArrivalSchema });
type Save = typeof SaveSchema.Type;

const stored = persisted<Save | null>(STORAGE_KEY, Schema.decodeUnknownSync(SaveSchema), () => null, {
  onError: (phase, error) =>
    console.warn(
      phase === "load"
        ? "[campagne] Sauvegarde indisponible ou illisible"
        : "[campagne] Reprise disponible dans cet onglet seulement",
      error,
    ),
});

let current: CampaignArrival | null = null;
let pending: CampaignArrival | null = null;
let loaded = false;
let persistenceFailed = false;

export function campaignArrival(): CampaignArrival | null {
  if (loaded) return current;
  loaded = true;
  const save = stored.load();
  if (save) current = freezeArrival(save.arrival);
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
  persistenceFailed = !stored.save({ version: 1, arrival });
  if (persistenceFailed) {
    useGameStore.getState().showHudMessage("Sauvegarde indisponible : la reprise sera perdue en fermant cet onglet.");
  }
}

export function campaignPersistenceFailed(): boolean {
  return persistenceFailed;
}
