import { afterEach, describe, expect, it, vi } from "vitest";

import { input } from "../../src/core/input";
import { inputRecorder } from "../../src/core/inputRecorder";
import { updateDisplayInput } from "../../src/game/loop/updateDisplayInput";
import { moveConfig } from "../../src/game/player/moveConfig";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("updateDisplayInput", () => {
  it("applique la souris à la visée avant que le pas fixe ne capture l'input", () => {
    vi.spyOn(input, "consumeMouseDelta").mockReturnValue({ dx: 12, dy: -5 });
    vi.spyOn(inputRecorder, "isPlaying").mockReturnValue(false);
    const engine = {
      look: { yaw: 0, pitch: 0 },
      lookDelta: { dx: 0, dy: 0 },
    };

    updateDisplayInput(engine);

    expect(engine.look.yaw).toBeCloseTo(-12 * moveConfig.lookSensitivity);
    expect(engine.look.pitch).toBeCloseTo(5 * moveConfig.lookSensitivity);
    expect(engine.lookDelta).toEqual({ dx: 12, dy: -5 });
  });

  it("borne le pitch et ignore la souris physique pendant un rejeu", () => {
    const pitchLimit = (moveConfig.pitchLimitDeg * Math.PI) / 180;
    vi.spyOn(input, "consumeMouseDelta").mockReturnValue({ dx: 0, dy: -100_000 });
    vi.spyOn(inputRecorder, "isPlaying").mockReturnValue(false);
    const engine = {
      look: { yaw: 1, pitch: 0 },
      lookDelta: { dx: 0, dy: 0 },
    };

    updateDisplayInput(engine);
    expect(engine.look.pitch).toBe(pitchLimit);

    vi.mocked(input.consumeMouseDelta).mockReturnValue({ dx: 8, dy: 8 });
    vi.mocked(inputRecorder.isPlaying).mockReturnValue(true);
    updateDisplayInput(engine);

    expect(engine.look).toEqual({ yaw: 1, pitch: pitchLimit });
    expect(engine.lookDelta).toEqual({ dx: 0, dy: -100_000 });
  });
});
