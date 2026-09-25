import { afterEach, describe, expect, it, vi } from "vitest";

import { FIXED_DT, startLoop, type LoopCallbacks, type LoopStats } from "../../src/core/loop";
import { input } from "../../src/core/input";

function runOneDisplayFrame(elapsedSeconds: number) {
  const scheduled: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    scheduled.push(callback);
    return scheduled.length;
  });
  vi.spyOn(performance, "now").mockReturnValue(0);

  const order: string[] = [];
  vi.spyOn(input, "beginFrame").mockImplementation(() => order.push("beginFrame"));
  vi.spyOn(input, "beginFixedStep").mockImplementation(() => order.push("beginFixedStep"));
  vi.spyOn(input, "endFrame").mockImplementation(() => order.push("endFrame"));

  let stats: LoopStats | null = null;
  const callbacks: LoopCallbacks = {
    updateDisplayInput: () => order.push("updateDisplayInput"),
    snapshotPrevious: () => order.push("snapshotPrevious"),
    updateGameplay: () => order.push("updateGameplay"),
    stepPhysics: () => order.push("stepPhysics"),
    interpolateVisuals: () => order.push("interpolateVisuals"),
    updateFx: (_realDt, currentStats) => {
      order.push("updateFx");
      stats = currentStats;
    },
    render: () => order.push("render"),
  };

  startLoop(callbacks);
  scheduled.shift()!(elapsedSeconds * 1000);
  return { order, stats: stats! };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("startLoop — ordre 0/1/N pas fixes", () => {
  it.each([
    ["zéro", FIXED_DT * 0.5, 0],
    ["un", FIXED_DT * 1.1, 1],
    ["plusieurs", FIXED_DT * 3.1, 3],
  ] as const)("exécute %s pas avec l'entrée d'affichage avant la simulation", (_label, elapsed, expectedSteps) => {
    const { order, stats } = runOneDisplayFrame(elapsed);
    const fixedStepOrder = ["beginFixedStep", "snapshotPrevious", "updateGameplay", "stepPhysics"];
    const expected = ["beginFrame", "updateDisplayInput"];
    for (let i = 0; i < expectedSteps; i++) expected.push(...fixedStepOrder);
    expected.push("interpolateVisuals", "updateFx", "render", "endFrame");

    expect(order).toEqual(expected);
    expect(stats.steps).toBe(expectedSteps);
  });

  it("clampe une seconde écoulée à quinze pas fixes", () => {
    const { stats } = runOneDisplayFrame(1);
    expect(stats.steps).toBe(15);
  });
});
