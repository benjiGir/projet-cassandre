import { describe, expect, it } from "vitest";
import { RollingP95 } from "../../src/core/rollingP95";

describe("RollingP95", () => {
  it("retourne zéro sans échantillon", () => {
    expect(new RollingP95().value()).toBe(0);
  });

  it("calcule le percentile sur une fenêtre glissante bornée", () => {
    const samples = new RollingP95(20);
    for (let i = 1; i <= 20; i++) samples.record(i);
    expect(samples.value()).toBe(19);
    samples.record(100);
    expect(samples.value()).toBe(20);
  });
});
