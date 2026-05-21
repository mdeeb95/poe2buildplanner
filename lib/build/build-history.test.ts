import { describe, expect, it } from "vitest";
import { buildStatesEqual, cloneBuild } from "./build-history";
import type { BuildState } from "@/schemas/build";

function base(): BuildState {
  return {
    name: "Test",
    description: "",
    className: "Witch",
    ascendancy: "",
    allocated: ["1", "2"],
    passiveWeaponSet: { "2": 1 },
    nodeLevels: {},
    skills: [],
    items: [],
  };
}

describe("buildStatesEqual", () => {
  it("detects allocation changes", () => {
    const a = base();
    const b = cloneBuild(a);
    b.allocated = [...a.allocated, "3"];
    expect(buildStatesEqual(a, b)).toBe(false);
  });

  it("detects weapon set changes", () => {
    const a = base();
    const b = cloneBuild(a);
    b.passiveWeaponSet = { "2": 2 };
    expect(buildStatesEqual(a, b)).toBe(false);
  });

  it("treats clones as equal", () => {
    const a = base();
    const b = cloneBuild(a);
    expect(buildStatesEqual(a, b)).toBe(true);
  });
});
