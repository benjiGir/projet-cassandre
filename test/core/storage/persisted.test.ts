import { afterEach, describe, expect, it, vi } from "vitest";

import { persisted } from "../../../src/core/storage/persisted";

function stockage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void data.set(key, value)),
  };
  vi.stubGlobal("localStorage", storage);
  return { data, storage };
}

const nombre = (stored: unknown): number => {
  if (typeof stored !== "number") throw new Error("pas un nombre");
  return stored;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("persisted", () => {
  it("relit ce qu'elle a écrit", () => {
    const { data } = stockage();
    const valeur = persisted("cle", nombre, () => 0);

    expect(valeur.save(42)).toBe(true);

    expect(data.get("cle")).toBe("42");
    expect(valeur.load()).toBe(42);
  });

  it("rend la valeur de repli quand rien n'est gardé, sans signaler d'erreur", () => {
    stockage();
    const onError = vi.fn();

    expect(persisted("cle", nombre, () => 7, { onError }).load()).toBe(7);
    expect(onError).not.toHaveBeenCalled();
  });

  it("rend la valeur de repli et signale un contenu que le décodeur refuse", () => {
    stockage({ cle: '"texte"' });
    const onError = vi.fn();

    expect(persisted("cle", nombre, () => 7, { onError }).load()).toBe(7);
    expect(onError).toHaveBeenCalledWith("load", expect.any(Error));
  });

  it("rend la valeur de repli sur un JSON illisible", () => {
    stockage({ cle: "{pas du json" });

    expect(persisted("cle", nombre, () => 7).load()).toBe(7);
  });

  it("laisse le décodeur réparer au lieu de refuser", () => {
    stockage({ cle: '{"volume": 9, "inconnu": true}' });
    const reglages = persisted(
      "cle",
      (stored) => ({ volume: Math.min(1, (stored as { volume: number }).volume) }),
      () => ({ volume: 0.5 }),
    );

    expect(reglages.load()).toEqual({ volume: 1 });
  });

  it("garde une chaîne telle quelle au format texte", () => {
    const { data } = stockage({ cle: "habitue" });
    const texte = persisted(
      "cle",
      (stored) => String(stored),
      () => "",
      { format: "text" },
    );

    expect(texte.load()).toBe("habitue");
    texte.save("lanceur");
    expect(data.get("cle")).toBe("lanceur");
  });

  it("sans stockage : lecture de repli silencieuse, écriture signalée comme perdue", () => {
    vi.stubGlobal("localStorage", undefined);
    const onError = vi.fn();
    const valeur = persisted("cle", nombre, () => 7, { onError });

    expect(valeur.load()).toBe(7);
    expect(onError).not.toHaveBeenCalled();
    expect(valeur.save(1)).toBe(false);
    expect(onError).toHaveBeenCalledWith("save", expect.any(Error));
  });

  it("rend `false` quand le stockage refuse l'écriture (quota)", () => {
    const { storage } = stockage();
    storage.setItem.mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(persisted("cle", nombre, () => 0).save(1)).toBe(false);
  });

  it("lit le stockage à chaque appel, pas à la création", () => {
    const valeur = persisted("cle", nombre, () => 0);
    stockage({ cle: "3" });

    expect(valeur.load()).toBe(3);
  });
});
