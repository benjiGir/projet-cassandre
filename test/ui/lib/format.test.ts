import { describe, expect, it } from "vitest";

import { formatViews } from "../../../src/ui/lib/format";

describe("formatViews", () => {
  it("sépare les milliers à la française", () => {
    // fr-FR sépare par une espace fine insécable (U+202F), pas une espace simple.
    expect(formatViews(84210)).toBe("84 210");
    expect(formatViews(12)).toBe("12");
  });
});
