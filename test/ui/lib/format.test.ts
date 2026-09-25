import { describe, expect, it } from "vitest";

import { formatDuration, formatPoints, formatViews } from "../../../src/ui/lib/format";

describe("formatViews", () => {
  it("sépare les milliers à la française", () => {
    // fr-FR sépare par une espace fine insécable (U+202F), pas une espace simple.
    expect(formatViews(84210)).toBe("84 210");
    expect(formatViews(12)).toBe("12");
  });
});

describe("formatPoints", () => {
  it("sépare les milliers à la française, même règle que formatViews", () => {
    expect(formatPoints(1500)).toBe("1 500");
    expect(formatPoints(0)).toBe("0");
  });
});

describe("formatDuration", () => {
  it("formate en m:ss, secondes complétées à deux chiffres", () => {
    expect(formatDuration(67)).toBe("1:07");
    expect(formatDuration(600)).toBe("10:00");
    expect(formatDuration(5)).toBe("0:05");
  });

  it("arrondit et ne descend jamais sous zéro", () => {
    expect(formatDuration(59.6)).toBe("1:00");
    expect(formatDuration(-10)).toBe("0:00");
  });
});
