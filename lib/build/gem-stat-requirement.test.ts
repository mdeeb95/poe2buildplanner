import { describe, expect, it } from "vitest";
import {
  formatStatRequirements,
  getActiveGemStatRequirement,
  getGemStatRequirementsAtLevel,
  getSupportStatRequirement,
} from "./gem-stat-requirement";

describe("getActiveGemStatRequirement", () => {
  it("matches PoE2DB Spark Int at levels 1–5 for multi 100", () => {
    expect(getActiveGemStatRequirement(1, 100)).toBe(4);
    expect(getActiveGemStatRequirement(2, 100)).toBe(9);
    expect(getActiveGemStatRequirement(3, 100)).toBe(14);
    expect(getActiveGemStatRequirement(4, 100)).toBe(21);
    expect(getActiveGemStatRequirement(5, 100)).toBe(28);
  });
});

describe("getSupportStatRequirement", () => {
  it("maps multiplier 100 to +5", () => {
    expect(getSupportStatRequirement(100)).toBe(5);
  });
});

describe("getGemStatRequirementsAtLevel", () => {
  it("returns flat support requirements", () => {
    expect(getGemStatRequirementsAtLevel(1, 0, 100, 0, true)).toEqual({
      reqStr: 0,
      reqDex: 5,
      reqInt: 0,
    });
  });
});

describe("formatStatRequirements", () => {
  it("formats multiple attributes", () => {
    expect(formatStatRequirements({ reqStr: 0, reqDex: 28, reqInt: 0 })).toBe("+28 Dex");
    expect(formatStatRequirements({ reqStr: 5, reqDex: 5, reqInt: 0 })).toBe("+5 Str, +5 Dex");
  });
});
