/**
 * Réglage des ennemis par la difficulté (`shared/enemyTuning.ts`) : PV et
 * dégâts multipliés sur une copie de la configuration de chaque espèce,
 * jamais sur une config globale.
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { directorConfig } from "../../../../src/game/entities/director/directorConfig";
import { DirectorManager } from "../../../../src/game/entities/director/directorManager";
import { rampantConfig } from "../../../../src/game/entities/rampant/rampantConfig";
import { NEUTRAL_ENEMY_TUNING, tuneEnemyConfig } from "../../../../src/game/entities/shared/enemyTuning";
import { suitConfig } from "../../../../src/game/entities/suit/suitConfig";
import { SuitManager } from "../../../../src/game/entities/suit/suitManager";
import type { DIFFICULTIES } from "../../../../src/game/session/progression/difficulty";
import { difficultyConfig } from "../../../../src/game/session/progression/difficulty";
import { initPhysics, PhysicsWorld } from "../../../../src/physics/world";

await initPhysics();

const GLOBALES = JSON.stringify({ suitConfig, rampantConfig, directorConfig });

function tuning(difficulty: (typeof DIFFICULTIES)[number]) {
  const rules = difficultyConfig[difficulty];
  return { hp: rules.enemyHp, damage: rules.enemyDamage };
}

describe("tuneEnemyConfig", () => {
  it("un réglage neutre rend la configuration elle-même : le panneau de réglage continue d'agir dessus", () => {
    expect(tuneEnemyConfig(suitConfig, NEUTRAL_ENEMY_TUNING)).toBe(suitConfig);
    expect(tuneEnemyConfig(suitConfig, tuning("habitue"))).toBe(suitConfig);
  });

  it("un ennemi garde au moins 1 PV et 1 point de dégâts, et les configs globales restent intactes", () => {
    const tuned = tuneEnemyConfig(rampantConfig, { hp: 0.001, damage: 0.001 });
    expect(tuned.maxHp).toBe(1);
    expect(tuned.attackDamage).toBe(1);
    expect(JSON.stringify({ suitConfig, rampantConfig, directorConfig })).toBe(GLOBALES);
  });
});

describe("PV et dégâts des ennemis d'une partie", () => {
  it.each(["client", "lanceur"] as const)(
    "%s : chaque espèce naît avec ses PV et ses dégâts multipliés",
    (difficulty) => {
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
    },
  );
});
