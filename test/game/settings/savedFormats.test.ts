/**
 * Format des sauvegardes déjà présentes dans le navigateur des joueurs : chaque
 * module doit relire ce qu'une version précédente a écrit, et réécrire sous la
 * même forme. Les modules lisent le stockage à leur chargement : chaque test
 * pose le stockage, puis charge un module neuf.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

function stockage(initial: Record<string, string> = {}): Map<string, string> {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  });
  vi.resetModules();
  return data;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sauvegardes relues et réécrites sous leur forme d'origine", () => {
  it("difficulté : texte brut, pas du JSON", async () => {
    const data = stockage({ "cassandre.difficulte": "lanceur" });
    const { getDifficulty, setDifficulty } = await import("../../../src/game/settings/difficultySettings");

    expect(getDifficulty()).toBe("lanceur");
    setDifficulty("client");
    expect(data.get("cassandre.difficulte")).toBe("client");
  });

  it("difficulté inconnue : retour à celle d'origine", async () => {
    stockage({ "cassandre.difficulte": "cauchemar" });
    const { getDifficulty } = await import("../../../src/game/settings/difficultySettings");

    expect(getDifficulty()).toBe("habitue");
  });

  it("intros vues : un tableau d'identifiants", async () => {
    const data = stockage({ "cassandre.histoire": '["niveau_v2", 12]' });
    const { hasSeenIntro, markIntroSeen } = await import("../../../src/game/settings/storySettings");

    expect(hasSeenIntro("niveau_v2")).toBe(true);
    markIntroSeen("metro");
    expect(JSON.parse(data.get("cassandre.histoire") ?? "")).toEqual(["niveau_v2", "metro"]);
  });

  it("records : un objet « niveau/difficulté », les lignes illisibles écartées", async () => {
    const data = stockage({
      "cassandre.records": JSON.stringify({
        "niveau_v2/habitue": { score: 1200, seconds: 480 },
        "niveau_v2/cauchemar": { score: 9999, seconds: 1 },
        "metro/client": { score: "beaucoup", seconds: 300 },
      }),
    });
    const { recordFor, submitRun } = await import("../../../src/game/settings/records");

    expect(recordFor("niveau_v2", "habitue")).toEqual({ score: 1200, seconds: 480 });
    expect(recordFor("metro", "client")).toBeNull();
    submitRun("metro", "client", 800, 300);
    expect(JSON.parse(data.get("cassandre.records") ?? "")).toEqual({
      "niveau_v2/habitue": { score: 1200, seconds: 480 },
      "metro/client": { score: 800, seconds: 300 },
    });
  });

  it("audio : un champ hors bornes ou absent ne fait pas perdre les autres", async () => {
    stockage({ "cassandre.audio": JSON.stringify({ general: 0.4, effets: 7, sousTitres: false }) });
    const { getAudioSettings } = await import("../../../src/game/settings/audioSettings");

    expect(getAudioSettings()).toMatchObject({
      general: 0.4,
      effets: 1,
      voix: 1,
      sousTitres: false,
      chatDuDirect: true,
    });
  });

  it("touches : une touche illisible garde sa valeur d'origine", async () => {
    const data = stockage({ "cassandre.keybinds": JSON.stringify({ moveForward: "KeyZ", jump: "" }) });
    const { loadStoredBindings, saveStoredBindings } = await import("../../../src/core/input/inputPersistence");
    const { DEFAULT_BINDINGS } = await import("../../../src/core/input/inputBindings");

    const bindings = loadStoredBindings();
    expect(bindings.moveForward).toBe("KeyZ");
    expect(bindings.jump).toBe(DEFAULT_BINDINGS.jump);
    saveStoredBindings({ ...bindings, jump: "KeyK" });
    expect(JSON.parse(data.get("cassandre.keybinds") ?? "")).toMatchObject({ moveForward: "KeyZ", jump: "KeyK" });
  });
});
