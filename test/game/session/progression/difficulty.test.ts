/**
 * Difficulté (lot B5) : les trois niveaux, leurs règles, et la taille des
 * groupes réveillés par le script de niveau. Ce que les règles font aux
 * ennemis est dans `test/game/entities/shared/enemyTuning.test.ts`, aux dons
 * dans `test/game/session/stream/streamSim.test.ts`.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  DIFFICULTY_INFO,
  difficultyConfig,
  isDifficulty,
  wokenGroupSize,
  wokenSpawns,
} from "../../../../src/game/session/progression/difficulty";

describe("les trois difficultés", () => {
  it("portent les noms du plan, de la plus douce à la plus dure", () => {
    expect(DIFFICULTIES.map((id) => DIFFICULTY_INFO[id].label)).toEqual(["Client", "Habitué", "Lanceur d'alerte"]);
    expect(DEFAULT_DIFFICULTY).toBe("habitue");
    expect(isDifficulty("lanceur")).toBe(true);
    expect(isDifficulty("cauchemar")).toBe(false);
    expect(isDifficulty(null)).toBe(false);
  });

  it("durcissent chaque réglage dans le même sens", () => {
    const [client, habitue, lanceur] = DIFFICULTIES.map((id) => difficultyConfig[id]);
    for (const key of ["enemyHp", "enemyDamage", "groupShare"] as const) {
      expect(client[key]).toBeLessThan(habitue[key]);
      expect(habitue[key]).toBeLessThan(lanceur[key]);
    }
    expect(client.donations).toBeGreaterThan(habitue.donations);
    expect(habitue.donations).toBeGreaterThan(lanceur.donations);
  });

  it("« Habitué » ne multiplie ni les ennemis ni les dons", () => {
    expect(difficultyConfig.habitue).toMatchObject({ enemyHp: 1, enemyDamage: 1, donations: 1 });
  });
});

describe("taille des groupes réveillés", () => {
  it("arrondit la part du groupe, sans jamais le vider ni le dépasser", () => {
    expect(wokenGroupSize(4, 0.5)).toBe(2);
    expect(wokenGroupSize(4, 0.75)).toBe(3);
    expect(wokenGroupSize(4, 1)).toBe(4);
    expect(wokenGroupSize(1, 0.5)).toBe(1);
    expect(wokenGroupSize(3, 0.1)).toBe(1);
    expect(wokenGroupSize(3, 2)).toBe(3);
    expect(wokenGroupSize(0, 1)).toBe(0);
  });

  it("garde les premiers spawns du groupe par ordre de nom, quel que soit l'ordre du fichier", () => {
    const spawns = [
      { name: "spawn_suit_arene_3", group: "arene" },
      { name: "spawn_suit_quai_1", group: "quai" },
      { name: "spawn_suit_arene_1", group: "arene" },
      { name: "spawn_suit_libre", group: null },
      { name: "spawn_suit_arene_4", group: "arene" },
      { name: "spawn_suit_arene_2", group: "arene" },
    ];
    const noms = (share: number) => wokenSpawns(spawns, "arene", share).map((spawn) => spawn.name);

    expect(noms(difficultyConfig.client.groupShare)).toEqual(["spawn_suit_arene_1", "spawn_suit_arene_2"]);
    expect(noms(difficultyConfig.habitue.groupShare)).toEqual([
      "spawn_suit_arene_1",
      "spawn_suit_arene_2",
      "spawn_suit_arene_3",
    ]);
    expect(noms(difficultyConfig.lanceur.groupShare)).toHaveLength(4);
    expect(wokenSpawns(spawns, "inconnu", 1)).toEqual([]);
  });
});
