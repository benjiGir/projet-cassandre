/**
 * Difficulté (lot B5) : les multiplicateurs de PV et de dégâts des ennemis, la
 * taille des groupes réveillés par le script de niveau, la générosité des
 * dons — posés sur la partie, jamais sur une config globale.
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { directorConfig } from "../../../../src/game/entities/director/directorConfig";
import { DirectorManager } from "../../../../src/game/entities/director/directorManager";
import { rampantConfig } from "../../../../src/game/entities/rampant/rampantConfig";
import { tuneEnemyConfig } from "../../../../src/game/entities/shared/enemyTuning";
import { suitConfig } from "../../../../src/game/entities/suit/suitConfig";
import { SuitManager } from "../../../../src/game/entities/suit/suitManager";
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  DIFFICULTY_INFO,
  difficultyConfig,
  difficultyEffects,
  isDifficulty,
  wokenGroupSize,
} from "../../../../src/game/session/progression/difficulty";
import { wokenSpawns } from "../../../../src/game/session/progression/levelScriptActions";
import { createStreamState, notifyStream } from "../../../../src/game/session/stream/streamSim";
import { initPhysics, PhysicsWorld } from "../../../../src/physics/world";

await initPhysics();

const GLOBALES = JSON.stringify({ suitConfig, rampantConfig, directorConfig });

/** Petit générateur déterministe, local au test. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function tuning(difficulty: (typeof DIFFICULTIES)[number]) {
  const rules = difficultyConfig[difficulty];
  return { hp: rules.enemyHp, damage: rules.enemyDamage };
}

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
      expect(client![key]).toBeLessThan(habitue![key]);
      expect(habitue![key]).toBeLessThan(lanceur![key]);
    }
    expect(client!.donations).toBeGreaterThan(habitue!.donations);
    expect(habitue!.donations).toBeGreaterThan(lanceur!.donations);
  });

  it("« Habitué » laisse les ennemis et les dons tels que les configs les posent", () => {
    expect(difficultyConfig.habitue).toMatchObject({ enemyHp: 1, enemyDamage: 1, donations: 1 });
    expect(tuneEnemyConfig(suitConfig, tuning("habitue"))).toBe(suitConfig);
  });

  it("se décrivent en clair pour l'écran de choix", () => {
    expect(difficultyEffects({ enemyHp: 0.75, enemyDamage: 1.5, groupShare: 0.5, donations: 1 })).toEqual([
      { label: "PV des ennemis", value: "−25 %" },
      { label: "Dégâts reçus", value: "+50 %" },
      { label: "Renforts", value: "50 %" },
      { label: "Dons du chat", value: "normal" },
    ]);
  });
});

describe("PV et dégâts des ennemis", () => {
  it.each(["client", "lanceur"] as const)("%s : chaque espèce naît avec ses PV et ses dégâts multipliés", (difficulty) => {
    const { enemyHp, enemyDamage } = difficultyConfig[difficulty];
    const physics = new PhysicsWorld();
    const suits = new SuitManager(physics, suitConfig, tuning(difficulty));
    const directors = new DirectorManager(physics, directorConfig, tuning(difficulty));

    const costard = suits.spawnSuit(0, 0, 0);
    const rampant = suits.spawnSuit(4, 0, 0, new THREE.Vector3(0, 0, 1), "rampant");
    const directeur = directors.spawnDirector(8, 0, 0);

    expect(costard.hp).toBe(Math.round(suitConfig.maxHp * enemyHp));
    expect(costard.cfg.attackDamage).toBe(Math.round(suitConfig.attackDamage * enemyDamage));
    expect(rampant.hp).toBe(Math.round(rampantConfig.maxHp * enemyHp));
    expect(rampant.cfg.attackDamage).toBe(Math.round(rampantConfig.attackDamage * enemyDamage));
    expect(directeur.hp).toBe(Math.round(directorConfig.maxHp * enemyHp));
    expect(directeur.cfg.attackDamage).toBe(Math.round(directorConfig.attackDamage * enemyDamage));
    // Le reste de la configuration ne bouge pas : même vitesse, même portée.
    expect(costard.cfg.chaseSpeed).toBe(suitConfig.chaseSpeed);
    expect(rampant.cfg.melee).toEqual(rampantConfig.melee);
  });

  it("un ennemi garde au moins 1 PV et 1 point de dégâts, et les configs globales restent intactes", () => {
    const tuned = tuneEnemyConfig(rampantConfig, { hp: 0.001, damage: 0.001 });
    expect(tuned.maxHp).toBe(1);
    expect(tuned.attackDamage).toBe(1);
    expect(JSON.stringify({ suitConfig, rampantConfig, directorConfig })).toBe(GLOBALES);
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
      "spawn_suit_arene_1", "spawn_suit_arene_2", "spawn_suit_arene_3",
    ]);
    expect(noms(difficultyConfig.lanceur.groupShare)).toHaveLength(4);
    expect(wokenSpawns(spawns, "inconnu", 1)).toEqual([]);
  });
});

describe("générosité des dons", () => {
  function donsRecus(generosity: number): number {
    const state = createStreamState(generosity);
    const random = rng(7);
    // Un kill isolé toutes les 10 s : jamais de série, jamais dans le délai entre deux dons.
    for (let i = 0; i < 400; i++) notifyStream(state, "kill", i * 10, random);
    return state.donationCount;
  }

  it("un chat plus généreux donne plus souvent, un chat plus dur moins souvent", () => {
    const normal = donsRecus(difficultyConfig.habitue.donations);
    expect(donsRecus(difficultyConfig.client.donations)).toBeGreaterThan(normal);
    expect(donsRecus(difficultyConfig.lanceur.donations)).toBeLessThan(normal);
    expect(donsRecus(0)).toBe(0);
  });

  it("sans réglage, le direct garde sa générosité d'origine", () => {
    expect(createStreamState().generosity).toBe(1);
  });
});
