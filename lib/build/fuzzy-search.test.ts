import { describe, expect, it } from "vitest";
import { fuzzyMatch, subsequenceMatch } from "./fuzzy-search.js";

describe("subsequenceMatch", () => {
  it("matches abbreviated prefixes", () => {
    expect(subsequenceMatch("Elemental Armament", "eleme")).toBe(true);
    expect(subsequenceMatch("Elemental Armament", "arma")).toBe(true);
  });

  it("rejects out-of-order letters", () => {
    expect(subsequenceMatch("Elemental Armament", "amre")).toBe(false);
  });
});

describe("fuzzyMatch", () => {
  it("matches multi-token queries across the full string", () => {
    expect(fuzzyMatch("Elemental Armament", "eleme arma")).toBe(true);
    expect(fuzzyMatch("Elemental Armament", "el arm")).toBe(true);
  });

  it("returns all rows for empty query", () => {
    expect(fuzzyMatch("Anything", "")).toBe(true);
    expect(fuzzyMatch("Anything", "   ")).toBe(true);
  });
});
