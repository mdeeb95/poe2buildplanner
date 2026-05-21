import { describe, expect, it } from "vitest";
import { isDataOnlyChange } from "./railway-build-lib.js";

describe("isDataOnlyChange", () => {
  it("accepts data and public paths only", () => {
    expect(isDataOnlyChange(["data/gems.json"])).toBe(true);
    expect(isDataOnlyChange(["public/tree/skills-64.webp"])).toBe(true);
    expect(isDataOnlyChange(["data/gems.json", "public/tree/x.webp"])).toBe(true);
  });

  it("rejects code or mixed changes", () => {
    expect(isDataOnlyChange(["app/page.tsx"])).toBe(false);
    expect(isDataOnlyChange(["data/gems.json", "lib/foo.ts"])).toBe(false);
    expect(isDataOnlyChange([])).toBe(false);
  });
});
