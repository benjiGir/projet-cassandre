import { describe, expect, it } from "vitest";

import {
  beginLoading,
  finishLoading,
  loadingSnapshot,
  reportLoading,
  waitForLoadingRetry,
} from "../../src/core/loadingProgress";

describe("loadingProgress", () => {
  it("rouvre une séquence après finishLoading", () => {
    beginLoading("Premier", 0.2);
    finishLoading();
    reportLoading("ignoré", 0.5);
    expect(loadingSnapshot()).toBeNull();

    beginLoading("Replay", 0.1);
    expect(loadingSnapshot()).toMatchObject({ status: "loading", label: "Replay", progress: 0.1 });
  });

  it("expose un échec récupérable dont l'action résout l'attente une seule fois", async () => {
    beginLoading("Niveau", 0.42);
    const waiting = waitForLoadingRetry(new Error("GLB invalide"));
    const failed = loadingSnapshot();

    expect(failed).toMatchObject({
      status: "failed",
      label: "Chargement interrompu",
      progress: 0.42,
      message: "GLB invalide",
    });
    if (failed?.status !== "failed") throw new Error("état d'échec attendu");
    failed.retry();
    failed.retry();
    await expect(waiting).resolves.toBeUndefined();
  });
});
