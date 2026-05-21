import { describe, expect, it } from "vitest";
import {
  clampLevel,
  formatGemLevel,
  fromLevelInterval,
  toLevelInterval,
} from "./levels";

describe("levels helpers", () => {
  it("clamps to 1–100", () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(150)).toBe(100);
    expect(clampLevel(22.7)).toBe(23);
  });

  it("round-trips level interval", () => {
    expect(toLevelInterval(12)).toEqual([12, 100]);
    expect(fromLevelInterval([12, 100])).toBe(12);
  });

  it("formats gem level display", () => {
    expect(formatGemLevel([1, 100])).toBe("L1");
    expect(formatGemLevel([12, 100])).toBe("L12");
    expect(formatGemLevel([12, 50])).toBe("L12+");
  });
});
