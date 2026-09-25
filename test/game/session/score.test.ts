/**
 * Barème et comptage du récap de fin de partie (`src/game/session/score.ts`)
 * — la partie PURE du module (`SessionStats`, `record*`, `buildLevelRecap`),
 * testée avec de simples objets, sans DOM/Three.js/Rapier. `publishLevelRecap`
 * (le seul point d'entrée impur) n'est pas testé ici : il ne fait que router
 * `buildLevelRecap` vers le store, couvert indirectement par les tests de
 * `game/session/doors.ts`/`feedback.ts` si besoin.
 */
import { describe, expect, it } from "vitest";

import {
  SCORE_ACCURACY_MAX_POINTS,
  SCORE_ALL_SECRETS_BONUS,
  SCORE_DIRECTOR_KILL,
  SCORE_PAR_TIME_POINTS_PER_SECOND,
  SCORE_SECRET,
  SCORE_SUIT_KILL,
  SCORE_VANDALISM_PROP,
  SCORE_VANDALISM_SANITAIRE,
  SCORE_VANDALISM_VITRE,
  advanceGameplayTime,
  buildLevelRecap,
  createInitialStats,
  recordDirectorKills,
  recordHpLost,
  recordPropsDestroyed,
  recordSanitairesDestroyed,
  recordShot,
  recordSuitKills,
  recordVitresDestroyed,
  type LevelRecapInput,
} from "../../../src/game/session/score";

function baseInput(overrides: Partial<LevelRecapInput> = {}): LevelRecapInput {
  return {
    stats: createInitialStats(),
    suitTotal: 0,
    directorTotal: 0,
    secretsFound: 0,
    secretsTotal: 0,
    parTimeSeconds: null,
    ...overrides,
  };
}

describe("createInitialStats", () => {
  it("démarre tous les compteurs à zéro", () => {
    expect(createInitialStats()).toEqual({
      suitKills: 0,
      directorKills: 0,
      shotsFired: 0,
      shotsHitEnemy: 0,
      propsDestroyed: 0,
      vitresDestroyed: 0,
      sanitairesDestroyed: 0,
      gameplayElapsed: 0,
      hpLost: 0,
    });
  });
});

describe("les compteurs record*/advanceGameplayTime", () => {
  it("advanceGameplayTime accumule le VRAI dt de gameplay, jamais un remplacement", () => {
    const stats = createInitialStats();
    advanceGameplayTime(stats, 0.5);
    advanceGameplayTime(stats, 0.25);
    expect(stats.gameplayElapsed).toBeCloseTo(0.75);
  });

  it("recordSuitKills/recordDirectorKills additionnent un delta, pas une valeur absolue", () => {
    const stats = createInitialStats();
    recordSuitKills(stats, 2);
    recordSuitKills(stats, 1);
    recordDirectorKills(stats, 1);
    expect(stats.suitKills).toBe(3);
    expect(stats.directorKills).toBe(1);
  });

  it("recordShot compte un tir, et un hit seulement si hitEnemy est vrai", () => {
    const stats = createInitialStats();
    recordShot(stats, false);
    recordShot(stats, true);
    recordShot(stats, true);
    expect(stats.shotsFired).toBe(3);
    expect(stats.shotsHitEnemy).toBe(2);
  });

  it("recordPropsDestroyed/recordVitresDestroyed/recordSanitairesDestroyed additionnent chacun leur delta indépendamment", () => {
    const stats = createInitialStats();
    recordPropsDestroyed(stats, 2);
    recordVitresDestroyed(stats, 1);
    recordSanitairesDestroyed(stats, 3);
    expect(stats).toMatchObject({ propsDestroyed: 2, vitresDestroyed: 1, sanitairesDestroyed: 3 });
  });

  it("recordHpLost ignore les montants non positifs", () => {
    const stats = createInitialStats();
    recordHpLost(stats, 20);
    recordHpLost(stats, 0);
    recordHpLost(stats, -5);
    expect(stats.hpLost).toBe(20);
  });
});

describe("buildLevelRecap — Costards/Directeur", () => {
  it("un Costard vaut SCORE_SUIT_KILL points, la ligne mentionne le total du niveau", () => {
    const stats = createInitialStats();
    recordSuitKills(stats, 15);
    const recap = buildLevelRecap(baseInput({ stats, suitTotal: 18 }));
    const line = recap.lines.find((l) => l.label === "Costards éliminés");
    expect(line).toMatchObject({ detail: `15/18 × ${SCORE_SUIT_KILL}`, points: 15 * SCORE_SUIT_KILL });
  });

  it("aucune ligne Directeur si le niveau n'en a aucun (directorTotal = 0)", () => {
    const recap = buildLevelRecap(baseInput({ directorTotal: 0 }));
    expect(recap.lines.some((l) => l.label === "Directeur éliminé")).toBe(false);
  });

  it("le Directeur rapporte SCORE_DIRECTOR_KILL sur un niveau qui en a un", () => {
    const stats = createInitialStats();
    recordDirectorKills(stats, 1);
    const recap = buildLevelRecap(baseInput({ stats, directorTotal: 1 }));
    const line = recap.lines.find((l) => l.label === "Directeur éliminé");
    expect(line?.points).toBe(SCORE_DIRECTOR_KILL);
  });
});

describe("buildLevelRecap — secrets", () => {
  it("aucune ligne si le niveau n'a aucun secret", () => {
    const recap = buildLevelRecap(baseInput({ secretsTotal: 0 }));
    expect(recap.lines.some((l) => l.label === "Secrets trouvés")).toBe(false);
  });

  it("secrets partiels : pas de bonus", () => {
    const recap = buildLevelRecap(baseInput({ secretsFound: 1, secretsTotal: 2 }));
    const line = recap.lines.find((l) => l.label === "Secrets trouvés");
    expect(line?.points).toBe(1 * SCORE_SECRET);
  });

  it("tous les secrets trouvés : bonus ajouté", () => {
    const recap = buildLevelRecap(baseInput({ secretsFound: 2, secretsTotal: 2 }));
    const line = recap.lines.find((l) => l.label === "Secrets trouvés");
    expect(line?.points).toBe(2 * SCORE_SECRET + SCORE_ALL_SECRETS_BONUS);
    expect(line?.detail).toContain("tous trouvés");
  });
});

describe("buildLevelRecap — précision", () => {
  it("0 tir : 0 % sans diviser par zéro", () => {
    const recap = buildLevelRecap(baseInput());
    expect(recap.accuracy).toBe(0);
    const line = recap.lines.find((l) => l.label === "Précision");
    expect(line?.points).toBe(0);
  });

  it("précision à 100 % rapporte le score maximal", () => {
    const stats = createInitialStats();
    recordShot(stats, true);
    recordShot(stats, true);
    const recap = buildLevelRecap(baseInput({ stats }));
    expect(recap.accuracy).toBe(1);
    const line = recap.lines.find((l) => l.label === "Précision");
    expect(line?.points).toBe(SCORE_ACCURACY_MAX_POINTS);
  });

  it("précision partielle proportionnelle, arrondie", () => {
    const stats = createInitialStats();
    recordShot(stats, true);
    recordShot(stats, false);
    recordShot(stats, false);
    const recap = buildLevelRecap(baseInput({ stats }));
    expect(recap.accuracy).toBeCloseTo(1 / 3);
    const line = recap.lines.find((l) => l.label === "Précision");
    expect(line?.points).toBe(Math.round((1 / 3) * SCORE_ACCURACY_MAX_POINTS));
  });
});

describe("buildLevelRecap — vandalisme", () => {
  it("aucune ligne si rien n'a été cassé", () => {
    const recap = buildLevelRecap(baseInput());
    expect(recap.lines.some((l) => l.label === "Vandalisme")).toBe(false);
  });

  it("chaque matière a son propre tarif", () => {
    const stats = createInitialStats();
    recordPropsDestroyed(stats, 2);
    recordVitresDestroyed(stats, 1);
    recordSanitairesDestroyed(stats, 1);
    const recap = buildLevelRecap(baseInput({ stats }));
    const line = recap.lines.find((l) => l.label === "Vandalisme");
    expect(line?.points).toBe(2 * SCORE_VANDALISM_PROP + 1 * SCORE_VANDALISM_VITRE + 1 * SCORE_VANDALISM_SANITAIRE);
  });
});

describe("buildLevelRecap — rapidité", () => {
  it("aucune ligne si parTimeSeconds est null (mort, ou niveau sans temps de référence)", () => {
    const recap = buildLevelRecap(baseInput({ parTimeSeconds: null }));
    expect(recap.lines.some((l) => l.label === "Rapidité")).toBe(false);
  });

  it("sous le temps de référence : des points, proportionnels aux secondes gagnées", () => {
    const stats = createInitialStats();
    advanceGameplayTime(stats, 480); // 8 min
    const recap = buildLevelRecap(baseInput({ stats, parTimeSeconds: 600 })); // 10 min
    const line = recap.lines.find((l) => l.label === "Rapidité");
    expect(line?.points).toBe(120 * SCORE_PAR_TIME_POINTS_PER_SECOND);
  });

  it("au-delà du temps de référence : zéro point, jamais négatif", () => {
    const stats = createInitialStats();
    advanceGameplayTime(stats, 700);
    const recap = buildLevelRecap(baseInput({ stats, parTimeSeconds: 600 }));
    const line = recap.lines.find((l) => l.label === "Rapidité");
    expect(line?.points).toBe(0);
    expect(line?.detail).toBe("Temps de référence dépassé");
  });
});

describe("buildLevelRecap — total et champs de tête", () => {
  it("le total est la somme exacte des points de chaque ligne", () => {
    const stats = createInitialStats();
    recordSuitKills(stats, 2);
    recordShot(stats, true);
    recordPropsDestroyed(stats, 1);
    const recap = buildLevelRecap(baseInput({ stats, suitTotal: 2 }));
    const expected = recap.lines.reduce((sum, l) => sum + l.points, 0);
    expect(recap.total).toBe(expected);
    expect(recap.total).toBeGreaterThan(0);
  });

  it("elapsedSeconds/parTimeSeconds reflètent les entrées telles quelles", () => {
    const stats = createInitialStats();
    advanceGameplayTime(stats, 42);
    const recap = buildLevelRecap(baseInput({ stats, parTimeSeconds: 600 }));
    expect(recap.elapsedSeconds).toBe(42);
    expect(recap.parTimeSeconds).toBe(600);
  });
});
