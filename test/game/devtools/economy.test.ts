/**
 * Équilibrage de l'économie (lot B7) : le relevé du portefeuille sur des
 * parties types, la cible du plan — deux ou trois perks pour une partie
 * normale, jamais les six —, et l'accord entre ce que le jeu embarque
 * (`streamConfig`), la variante B et les prix posés dans le niveau.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PARCOURS, PROFILES, simulateRun, summarize, type ProfileId } from "../../../src/game/devtools/economy/economySim";
import {
  ECONOMY_DEFAULT,
  ECONOMY_VARIANTS,
  applyDonations,
  applyEconomyVariant,
  type EconomyVariantId,
} from "../../../src/game/devtools/economy/economyVariants";
import { offerPrice, perkPrices } from "../../../src/game/player/perkConfig";
import { PERKS, type Perk } from "../../../src/game/player/perks";
import { DIFFICULTIES } from "../../../src/game/session/progression/difficulty";
import { streamConfig } from "../../../src/game/session/stream/streamSim";

const EMBARQUE = JSON.stringify({ rules: streamConfig.rules, mystery: streamConfig.mystery });
const B = ECONOMY_VARIANTS.B;

afterEach(() => {
  applyDonations(ECONOMY_VARIANTS[ECONOMY_DEFAULT]);
  for (const perk of PERKS) delete perkPrices[perk];
  vi.restoreAllMocks();
});

describe("relevé du portefeuille", () => {
  it("même graine, même relevé", () => {
    const a = simulateRun(PROFILES.normal, "habitue", B.prices, 7);
    const b = simulateRun(PROFILES.normal, "habitue", B.prices, 7);
    expect(a).toEqual(b);
    expect(a.kiosks.length).toBeGreaterThan(0);
  });

  it("passe devant les six bornes, une par perk, et retrouve celle du couloir au retour du parking", () => {
    const bornes = PARCOURS.flatMap((stop) => (stop.kiosk && !stop.detour ? [stop.kiosk] : []));
    expect([...new Set(bornes)].sort()).toEqual([...PERKS].sort());
    expect(bornes.filter((perk) => perk === "boisson")).toHaveLength(2);
  });

  it("ne compte comme utile que ce qui tombe avant la dernière borne : le don du Directeur arrive trop tard", () => {
    const run = simulateRun(PROFILES.normal, "habitue", B.prices, 3);
    expect(run.spendable).toBeLessThan(run.donated);
    expect(run.best).toBeGreaterThanOrEqual(run.bought.length);
  });
});

describe("variante B — celle du jeu", () => {
  it("est ce que `streamConfig` embarque : l'appliquer ne change rien", () => {
    expect(ECONOMY_DEFAULT).toBe("B");
    applyDonations(B);
    expect(JSON.stringify({ rules: streamConfig.rules, mystery: streamConfig.mystery })).toBe(EMBARQUE);
  });

  it("ses prix sont ceux que la recette pose dans le niveau", () => {
    // `refresh_perk_kiosks.py` : une ligne `("use_borne_x", "perk", prix, …)` par borne.
    const recette = new TextDecoder().decode(readFileSync(resolve("tools/blender/refresh_perk_kiosks.py")));
    const poses = Object.fromEntries(
      [...recette.matchAll(/^ {4}\("use_borne_\w+", "(\w+)", (\d+),/gm)].map((m) => [m[1], Number(m[2])]),
    );
    expect(poses).toEqual(B.prices);
  });

  it("une partie normale s'offre deux ou trois perks, jamais les six", () => {
    const normal = summarize("normal", "habitue", B.prices);
    expect(normal.bought[1]).toBeGreaterThanOrEqual(2);
    expect(normal.bought[1]).toBeLessThanOrEqual(3);
    expect(normal.bought[0]).toBeGreaterThanOrEqual(1);
    expect(normal.best[2]).toBeLessThan(PERKS.length);
  });

  it("foncer en laisse un ou deux, tout fouiller en donne davantage", () => {
    const presse = summarize("presse", "habitue", B.prices);
    const completiste = summarize("completiste", "habitue", B.prices);
    expect(presse.bought[1]).toBeGreaterThanOrEqual(1);
    expect(presse.bought[1]).toBeLessThanOrEqual(2);
    expect(completiste.best[1]).toBeGreaterThanOrEqual(presse.best[1]);
    expect(completiste.spendable).toBeGreaterThan(presse.spendable);
  });

  it("chaque perk est à la portée d'un joueur normal qui économise pour lui", () => {
    // Le total reçu en arrivant devant la borne (dernier passage) couvre son prix, en médiane.
    const runs = Array.from({ length: 100 }, (_, seed) => simulateRun(PROFILES.normal, "habitue", B.prices, seed + 1));
    for (const perk of PERKS) {
      const recus = runs.map((run) => {
        const dernier = run.kiosks.filter((kiosk) => kiosk.perk === perk).at(-1)!;
        // Solde à l'arrivée + ce qui a déjà été dépensé = total reçu jusque-là.
        const depense = run.kiosks
          .filter((kiosk) => kiosk.at < dernier.at && kiosk.bought)
          .reduce((sum, kiosk) => sum + kiosk.price, 0);
        return dernier.wallet + depense;
      });
      const mediane = [...recus].sort((a, b) => a - b)[50]!;
      expect(mediane, perk).toBeGreaterThanOrEqual(B.prices[perk]);
    }
  });
});

describe("les trois variantes", () => {
  it("aucune ne laisse acheter les six perks, quels que soient le profil et la difficulté", () => {
    for (const nom of Object.keys(ECONOMY_VARIANTS) as EconomyVariantId[]) {
      applyDonations(ECONOMY_VARIANTS[nom]);
      for (const difficulte of DIFFICULTIES) {
        for (const profil of Object.keys(PROFILES) as ProfileId[]) {
          const releve = summarize(profil, difficulte, ECONOMY_VARIANTS[nom].prices, 60);
          expect(releve.best[2], `${nom} ${difficulte} ${profil}`).toBeLessThan(PERKS.length);
        }
      }
    }
  });

  it("vont de la plus serrée à la plus généreuse", () => {
    const utile = (nom: EconomyVariantId) => {
      applyDonations(ECONOMY_VARIANTS[nom]);
      return summarize("normal", "habitue", ECONOMY_VARIANTS[nom].prices, 100).spendable;
    };
    const [a, b, c] = [utile("A"), utile("B"), utile("C")];
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    const total = (nom: EconomyVariantId) => Object.values(ECONOMY_VARIANTS[nom].prices).reduce((x, y) => x + y, 0);
    expect(total("A")).toBeGreaterThan(total("B"));
    expect(total("B")).toBeGreaterThan(total("C"));
  });

  it("le donateur mystère donne de plus en plus, dans chacune", () => {
    for (const variante of Object.values(ECONOMY_VARIANTS)) {
      const montants = Object.values(variante.mystery);
      expect(montants).toEqual([...montants].sort((x, y) => x - y));
    }
  });
});

describe("prix d'une borne", () => {
  const offre = { perk: "gilet" as Perk, price: 85 };

  it("est celui du niveau tant qu'aucune variante n'est à l'essai", () => {
    expect(offerPrice(offre)).toBe(85);
  });

  it("une variante à l'essai impose le sien, pour les six perks", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    applyEconomyVariant("A");
    expect(offerPrice(offre)).toBe(ECONOMY_VARIANTS.A.prices.gilet);
    expect(Object.keys(perkPrices).sort()).toEqual([...PERKS].sort());
    expect(streamConfig.mystery.escalier).toBe(ECONOMY_VARIANTS.A.mystery.escalier);
  });
});
