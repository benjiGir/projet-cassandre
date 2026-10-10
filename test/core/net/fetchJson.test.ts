import { afterEach, describe, expect, it, vi } from "vitest";

import { FETCH_TIMEOUT_MS, fetchJson } from "../../../src/core/net/fetchJson";

function repondre(response: Partial<Response>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchJson", () => {
  it("rend le contenu décodé", async () => {
    repondre({ ok: true, json: () => Promise.resolve({ valeur: 3 }) });

    const lu = await fetchJson("/manifeste.json", (raw) => (raw as { valeur: number }).valeur * 2);

    expect(lu).toBe(6);
  });

  it("borne l'attente par le délai commun", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = repondre({ ok: true, json: () => Promise.resolve(null) });

    await fetchJson("/manifeste.json", (raw) => raw);

    expect(timeout).toHaveBeenCalledWith(FETCH_TIMEOUT_MS);
    expect(fetchMock).toHaveBeenCalledWith("/manifeste.json", { signal: timeout.mock.results[0]?.value });
  });

  it("rejette sur un statut HTTP d'erreur, sans lire le corps", async () => {
    const json = vi.fn();
    repondre({ ok: false, status: 404, json });

    await expect(fetchJson("/absent.json", (raw) => raw)).rejects.toThrow("HTTP 404");
    expect(json).not.toHaveBeenCalled();
  });

  it("laisse remonter le refus du décodeur", async () => {
    repondre({ ok: true, json: () => Promise.resolve({}) });

    await expect(
      fetchJson("/manifeste.json", () => {
        throw new Error("forme inattendue");
      }),
    ).rejects.toThrow("forme inattendue");
  });
});
