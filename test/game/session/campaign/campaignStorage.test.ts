/**
 * Sauvegarde de campagne : l'équipement d'arrivée au métro, écrit une fois
 * dans `localStorage` et relu au lancement suivant. Une sauvegarde illisible,
 * d'une autre version ou incohérente est ignorée — jamais appliquée à moitié.
 *
 * Le module garde son état en mémoire : chaque test repart d'un module neuf,
 * comme un onglet qu'on vient d'ouvrir.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignArrival } from "../../../../src/game/session/campaign/campaignTypes";

const STORAGE_KEY = "cassandre.campaign.v1";

const ARRIVEE: CampaignArrival = {
  weapons: { owned: ["melee", "pistol", "shotgun"], active: "shotgun", pistolAmmo: 60, shotgunAmmo: 12 },
  perks: ["perche", "gilet"],
  wallet: 37,
  hp: 110,
  difficulty: "lanceur",
};

class FakeStorage {
  readonly items = new Map<string, string>();
  readonly getItem = vi.fn((key: string) => this.items.get(key) ?? null);
  readonly setItem = vi.fn((key: string, value: string) => void this.items.set(key, value));

  /** Lectures de la sauvegarde de campagne — les préférences lisent le même stockage à l'import. */
  get campaignReads(): number {
    return this.getItem.mock.calls.filter(([key]) => key === STORAGE_KEY).length;
  }
}

/** Un onglet neuf : le module de sauvegarde et le store du HUD, sans rien en mémoire. */
async function onglet() {
  vi.resetModules();
  const storage = await import("../../../../src/game/session/campaign/campaignStorage");
  const { useGameStore } = await import("../../../../src/game/hud/state");
  return { ...storage, hudMessage: () => useGameStore.getState().hudMessage };
}

function sauvegarde(arrival: unknown, version: unknown = 1): string {
  return JSON.stringify({ version, arrival });
}

let storage: FakeStorage;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  storage = new FakeStorage();
  vi.stubGlobal("localStorage", storage);
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("campaignStorage — aller-retour", () => {
  it("sans sauvegarde, il n'y a rien à reprendre", async () => {
    const { campaignArrival } = await onglet();

    expect(campaignArrival()).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("une arrivée écrite se relit à l'identique dans un onglet neuf", async () => {
    const premier = await onglet();
    premier.queueCampaignSave(ARRIVEE);
    premier.flushCampaignSave();

    expect(JSON.parse(storage.items.get(STORAGE_KEY)!)).toEqual({ version: 1, arrival: ARRIVEE });

    const second = await onglet();
    expect(second.campaignArrival()).toEqual(ARRIVEE);
    expect(second.campaignPersistenceFailed()).toBe(false);
  });

  it("l'arrivée reprise est figée : la partie ne peut pas réécrire la sauvegarde en mémoire", async () => {
    storage.items.set(STORAGE_KEY, sauvegarde(ARRIVEE));
    const { campaignArrival } = await onglet();

    const arrival = campaignArrival()!;

    expect(Object.isFrozen(arrival)).toBe(true);
    expect(Object.isFrozen(arrival.weapons)).toBe(true);
    expect(Object.isFrozen(arrival.weapons.owned)).toBe(true);
    expect(Object.isFrozen(arrival.perks)).toBe(true);
  });

  it("une arrivée mise en file est disponible tout de suite, avant même d'être écrite", async () => {
    const { campaignArrival, queueCampaignSave } = await onglet();

    queueCampaignSave(ARRIVEE);

    expect(campaignArrival()).toEqual(ARRIVEE);
    expect(storage.setItem).not.toHaveBeenCalled();
    // La file fait foi : l'ancienne sauvegarde du disque n'est plus relue.
    expect(storage.campaignReads).toBe(0);
  });

  it("la file garde une copie : modifier l'objet d'origine ne change pas ce qui sera écrit", async () => {
    const { queueCampaignSave, flushCampaignSave } = await onglet();
    const mutable = { ...ARRIVEE, weapons: { ...ARRIVEE.weapons, owned: [...ARRIVEE.weapons.owned] } };

    queueCampaignSave(mutable);
    mutable.wallet = 9999;
    mutable.weapons.owned.length = 0;
    flushCampaignSave();

    expect(JSON.parse(storage.items.get(STORAGE_KEY)!).arrival).toEqual(ARRIVEE);
  });
});

describe("campaignStorage — une seule lecture, une seule écriture", () => {
  it("le disque n'est lu qu'une fois par onglet", async () => {
    storage.items.set(STORAGE_KEY, sauvegarde(ARRIVEE));
    const { campaignArrival } = await onglet();

    campaignArrival();
    campaignArrival();
    campaignArrival();

    expect(storage.campaignReads).toBe(1);
  });

  it("`flushCampaignSave` sans rien en file n'écrit rien : il peut tourner à chaque image", async () => {
    const { flushCampaignSave, queueCampaignSave } = await onglet();

    for (let image = 0; image < 600; image++) flushCampaignSave();
    expect(storage.setItem).not.toHaveBeenCalled();

    queueCampaignSave(ARRIVEE);
    for (let image = 0; image < 600; image++) flushCampaignSave();
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it("deux arrivées mises en file avant l'écriture : seule la dernière est écrite", async () => {
    const { flushCampaignSave, queueCampaignSave, campaignArrival } = await onglet();

    queueCampaignSave(ARRIVEE);
    queueCampaignSave({ ...ARRIVEE, wallet: 5 });
    flushCampaignSave();

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.items.get(STORAGE_KEY)!).arrival.wallet).toBe(5);
    expect(campaignArrival()?.wallet).toBe(5);
  });
});

describe("campaignStorage — sauvegarde refusée", () => {
  async function relire(raw: string): Promise<CampaignArrival | null> {
    storage.items.set(STORAGE_KEY, raw);
    const { campaignArrival } = await onglet();
    return campaignArrival();
  }

  it("du JSON corrompu est ignoré, avec un avertissement préfixé", async () => {
    expect(await relire("{version: 1, arrival")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe("[campagne] Sauvegarde indisponible ou illisible");
  });

  it("une autre version de sauvegarde est ignorée", async () => {
    expect(await relire(sauvegarde(ARRIVEE, 2))).toBeNull();
    expect(await relire(JSON.stringify({ arrival: ARRIVEE }))).toBeNull();
  });

  it("une valeur hors du domaine est ignorée", async () => {
    expect(await relire(sauvegarde({ ...ARRIVEE, difficulty: "dieu" }))).toBeNull();
    expect(await relire(sauvegarde({ ...ARRIVEE, perks: ["perche", "invincible"] }))).toBeNull();
    expect(await relire(sauvegarde({ ...ARRIVEE, wallet: -1 }))).toBeNull();
    expect(await relire(sauvegarde({ ...ARRIVEE, hp: 0 }))).toBeNull();
    expect(await relire(sauvegarde({ ...ARRIVEE, weapons: { ...ARRIVEE.weapons, pistolAmmo: 1.5 } }))).toBeNull();
    expect(await relire(sauvegarde({ ...ARRIVEE, weapons: { ...ARRIVEE.weapons, active: "bazooka" } }))).toBeNull();
  });

  it("un champ manquant est ignoré", async () => {
    const { wallet: _wallet, ...sansSolde } = ARRIVEE;

    expect(await relire(sauvegarde(sansSolde))).toBeNull();
  });

  it("un perk ou une arme en double est ignoré", async () => {
    expect(await relire(sauvegarde({ ...ARRIVEE, perks: ["gilet", "gilet"] }))).toBeNull();
    expect(
      await relire(sauvegarde({ ...ARRIVEE, weapons: { ...ARRIVEE.weapons, owned: ["melee", "melee", "shotgun"] } })),
    ).toBeNull();
  });

  it("un équipement incohérent est ignoré : arme en main non possédée", async () => {
    expect(
      await relire(sauvegarde({ ...ARRIVEE, weapons: { ...ARRIVEE.weapons, owned: ["melee"], active: "shotgun" } })),
    ).toBeNull();
    // Les mains vides restent une arrivée valide.
    expect(
      await relire(sauvegarde({ ...ARRIVEE, weapons: { ...ARRIVEE.weapons, owned: [], active: "none" } })),
    ).not.toBeNull();
  });

  it("des PV au-dessus du maximum ne passent qu'avec le gilet", async () => {
    expect(await relire(sauvegarde({ ...ARRIVEE, hp: 125 }))).not.toBeNull();
    expect(await relire(sauvegarde({ ...ARRIVEE, hp: 126 }))).toBeNull();
    expect(await relire(sauvegarde({ ...ARRIVEE, perks: ["perche"], hp: 100 }))).not.toBeNull();
    expect(await relire(sauvegarde({ ...ARRIVEE, perks: ["perche"], hp: 110 }))).toBeNull();
  });

  it("des munitions au-dessus du plafond ne passent qu'avec le perk qui le relève", async () => {
    const balles = (pistolAmmo: number, perks: readonly string[]) =>
      relire(sauvegarde({ ...ARRIVEE, hp: 50, perks, weapons: { ...ARRIVEE.weapons, pistolAmmo } }));

    expect(await balles(150, [])).not.toBeNull();
    expect(await balles(151, [])).toBeNull();
    expect(await balles(200, ["premium"])).not.toBeNull();
    expect(await balles(201, ["premium"])).toBeNull();
    expect(await relire(sauvegarde({ ...ARRIVEE, weapons: { ...ARRIVEE.weapons, shotgunAmmo: 97 } }))).toBeNull();
  });
});

describe("campaignStorage — stockage indisponible", () => {
  it("écriture refusée : la reprise reste possible dans l'onglet, et le joueur est prévenu", async () => {
    storage.setItem.mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    const { campaignArrival, campaignPersistenceFailed, flushCampaignSave, queueCampaignSave, hudMessage } =
      await onglet();

    queueCampaignSave(ARRIVEE);
    flushCampaignSave();

    expect(campaignPersistenceFailed()).toBe(true);
    expect(campaignArrival()).toEqual(ARRIVEE);
    expect(hudMessage()).toBe("Sauvegarde indisponible : la reprise sera perdue en fermant cet onglet.");
    expect(warn.mock.calls[0][0]).toBe("[campagne] Reprise disponible dans cet onglet seulement");
  });

  it("un échec n'est pas retenté à chaque image, et une écriture réussie lève l'alerte", async () => {
    storage.setItem.mockImplementationOnce(() => {
      throw new Error("refusé");
    });
    const { campaignPersistenceFailed, flushCampaignSave, queueCampaignSave } = await onglet();

    queueCampaignSave(ARRIVEE);
    for (let image = 0; image < 60; image++) flushCampaignSave();
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(campaignPersistenceFailed()).toBe(true);

    queueCampaignSave(ARRIVEE);
    flushCampaignSave();
    expect(campaignPersistenceFailed()).toBe(false);
    expect(storage.items.has(STORAGE_KEY)).toBe(true);
  });

  it("lecture refusée : pas de reprise, pas d'exception", async () => {
    storage.getItem.mockImplementation(() => {
      throw new DOMException("interdit", "SecurityError");
    });
    const { campaignArrival } = await onglet();

    expect(campaignArrival()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("sans `localStorage` du tout : lecture vide, écriture signalée comme perdue", async () => {
    vi.stubGlobal("localStorage", undefined);
    const { campaignArrival, campaignPersistenceFailed, flushCampaignSave, queueCampaignSave } = await onglet();

    expect(campaignArrival()).toBeNull();
    queueCampaignSave(ARRIVEE);
    flushCampaignSave();

    expect(campaignPersistenceFailed()).toBe(true);
    expect(campaignArrival()).toEqual(ARRIVEE);
  });
});
