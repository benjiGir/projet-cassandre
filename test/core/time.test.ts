import { describe, expect, it } from "vitest";

import { GameClock } from "../../src/core/time";

describe("GameClock.reset", () => {
  it("efface le temps et le hitstop d'une session terminée", () => {
    const clock = new GameClock();
    clock.triggerHitstop(0.2, 0.05);
    expect(clock.tick(1 / 60)).toBeCloseTo((1 / 60) * 0.05);

    clock.reset();

    expect(clock.elapsed).toBe(0);
    expect(clock.tick(1 / 60)).toBeCloseTo(1 / 60);
  });
});
