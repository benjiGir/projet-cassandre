/**
 * Ce que l'écran de choix montre de chaque difficulté
 * (`presentation/difficultyOptions.ts`) : ses règles dites en clair, et le
 * record du joueur dans chacune.
 */
import { afterEach, describe, expect, it } from "vitest";

import { difficultyEffects, difficultyOptions } from "../../../../src/game/session/presentation/difficultyOptions";
import { DIFFICULTY_INFO } from "../../../../src/game/session/progression/difficulty";
import { resetRecords, submitRun } from "../../../../src/game/settings/records";

afterEach(() => {
  resetRecords();
});

describe("difficultyEffects", () => {
  it("dit chaque règle en clair, en écart à la normale", () => {
    expect(difficultyEffects({ enemyHp: 0.75, enemyDamage: 1.5, groupShare: 0.5, donations: 1 })).toEqual([
      { label: "PV des ennemis", value: "−25 %" },
      { label: "Dégâts reçus", value: "+50 %" },
      { label: "Renforts", value: "50 %" },
      { label: "Dons du chat", value: "normal" },
    ]);
  });
});

describe("difficultyOptions", () => {
  it("rend les trois difficultés dans l'ordre, avec leur nom et leurs quatre lignes", () => {
    const options = difficultyOptions("niveau_v2");
    expect(options.map((option) => option.id)).toEqual(["client", "habitue", "lanceur"]);
    expect(options.map((option) => option.label)).toEqual(Object.values(DIFFICULTY_INFO).map((info) => info.label));
    for (const option of options) expect(option.effects).toHaveLength(4);
  });

  it("rappelle le record du niveau demandé, difficulté par difficulté", () => {
    submitRun("niveau_v2", "lanceur", 9000, 480);
    const [client, habitue, lanceur] = difficultyOptions("niveau_v2");
    expect(client.record).toBeNull();
    expect(habitue.record).toBeNull();
    expect(lanceur.record).toEqual({ score: 9000, seconds: 480 });
    expect(difficultyOptions("gym").every((option) => option.record === null)).toBe(true);
  });
});
