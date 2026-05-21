import { describe, expect, it } from "vitest";
import { createEmptyBuild } from "./defaults";
import {
  allocatedEdgeRole,
  WEAPON_SET_MAX,
  applyAllocation,
  clearAllocation,
  globalCount,
  nodeAllocState,
  setCount,
  targetToWeaponSet,
  unallocate,
} from "./weapon-set";
import type { BuildState } from "@/schemas/build";

function build(): BuildState {
  return createEmptyBuild();
}

describe("targetToWeaponSet", () => {
  it("maps targets to weapon set numbers", () => {
    expect(targetToWeaponSet("global")).toBeNull();
    expect(targetToWeaponSet("set1")).toBe(1);
    expect(targetToWeaponSet("set2")).toBe(2);
  });
});

describe("nodeAllocState", () => {
  it("reports the four states", () => {
    let b = build();
    expect(nodeAllocState(b, "n1")).toBe("unallocated");
    b = applyAllocation(b, "n1", "global", { toggle: true }).build;
    expect(nodeAllocState(b, "n1")).toBe("global");
    b = applyAllocation(b, "n2", "set1", { toggle: true }).build;
    expect(nodeAllocState(b, "n2")).toBe("set1");
    b = applyAllocation(b, "n3", "set2", { toggle: true }).build;
    expect(nodeAllocState(b, "n3")).toBe("set2");
  });
});

describe("applyAllocation — allocate / toggle / reassign", () => {
  it("allocates an unallocated node to the target", () => {
    const r = applyAllocation(build(), "n1", "set1", { toggle: true });
    expect(r.rejectedSet).toBeNull();
    expect(nodeAllocState(r.build, "n1")).toBe("set1");
    expect(r.build.allocated).toContain("n1");
    expect(r.build.passiveWeaponSet["n1"]).toBe(1);
  });

  it("toggles off a node already in the target state (plain click)", () => {
    let b = applyAllocation(build(), "n1", "global", { toggle: true }).build;
    b = applyAllocation(b, "n1", "global", { toggle: true }).build;
    expect(nodeAllocState(b, "n1")).toBe("unallocated");
    expect(b.allocated).not.toContain("n1");
  });

  it("reassigns a node from one state to another (plain click, different mode)", () => {
    let b = applyAllocation(build(), "n1", "global", { toggle: true }).build;
    b = applyAllocation(b, "n1", "set2", { toggle: true }).build;
    expect(nodeAllocState(b, "n1")).toBe("set2");
    expect(b.allocated).toContain("n1");
    expect(b.passiveWeaponSet["n1"]).toBe(2);
  });

  it("chord (toggle:false) sets idempotently and never unallocates", () => {
    let b = applyAllocation(build(), "n1", "set1", { toggle: false }).build;
    // Same chord again — stays set1 (no toggle-off).
    b = applyAllocation(b, "n1", "set1", { toggle: false }).build;
    expect(nodeAllocState(b, "n1")).toBe("set1");
  });

  it("moving a global node into a set clears global; moving back to global clears the set", () => {
    let b = applyAllocation(build(), "n1", "global", { toggle: true }).build;
    b = applyAllocation(b, "n1", "set1", { toggle: false }).build;
    expect(b.passiveWeaponSet["n1"]).toBe(1);
    b = applyAllocation(b, "n1", "global", { toggle: false }).build;
    expect(b.passiveWeaponSet["n1"]).toBeUndefined();
    expect(b.allocated).toContain("n1");
  });
});

describe("applyAllocation — 24-per-set budget", () => {
  it("rejects allocating past WEAPON_SET_MAX in a set", () => {
    let b = build();
    for (let i = 0; i < WEAPON_SET_MAX; i++) {
      b = applyAllocation(b, `s1-${i}`, "set1", { toggle: false }).build;
    }
    expect(setCount(b, 1)).toBe(WEAPON_SET_MAX);
    const r = applyAllocation(b, "overflow", "set1", { toggle: false });
    expect(r.rejectedSet).toBe(1);
    expect(r.build).toBe(b); // unchanged reference
    expect(nodeAllocState(r.build, "overflow")).toBe("unallocated");
  });

  it("allows re-targeting a node already in the full set (no net increase)", () => {
    let b = build();
    for (let i = 0; i < WEAPON_SET_MAX; i++) {
      b = applyAllocation(b, `s1-${i}`, "set1", { toggle: false }).build;
    }
    // Re-applying set1 to a node already in set1 must not be rejected.
    const r = applyAllocation(b, "s1-0", "set1", { toggle: false });
    expect(r.rejectedSet).toBeNull();
    expect(setCount(r.build, 1)).toBe(WEAPON_SET_MAX);
  });

  it("always allows moving a node OUT of a full set", () => {
    let b = build();
    for (let i = 0; i < WEAPON_SET_MAX; i++) {
      b = applyAllocation(b, `s1-${i}`, "set1", { toggle: false }).build;
    }
    const r = applyAllocation(b, "s1-0", "global", { toggle: false });
    expect(r.rejectedSet).toBeNull();
    expect(setCount(r.build, 1)).toBe(WEAPON_SET_MAX - 1);
    expect(nodeAllocState(r.build, "s1-0")).toBe("global");
  });

  it("does not cap global allocation", () => {
    let b = build();
    for (let i = 0; i < WEAPON_SET_MAX + 10; i++) {
      const r = applyAllocation(b, `g-${i}`, "global", { toggle: false });
      expect(r.rejectedSet).toBeNull();
      b = r.build;
    }
    expect(globalCount(b)).toBe(WEAPON_SET_MAX + 10);
  });

  it("tracks set1 and set2 independently", () => {
    let b = build();
    for (let i = 0; i < WEAPON_SET_MAX; i++) {
      b = applyAllocation(b, `s1-${i}`, "set1", { toggle: false }).build;
      b = applyAllocation(b, `s2-${i}`, "set2", { toggle: false }).build;
    }
    expect(setCount(b, 1)).toBe(WEAPON_SET_MAX);
    expect(setCount(b, 2)).toBe(WEAPON_SET_MAX);
    expect(applyAllocation(b, "x", "set1", { toggle: false }).rejectedSet).toBe(1);
    expect(applyAllocation(b, "x", "set2", { toggle: false }).rejectedSet).toBe(2);
  });
});

describe("unallocate / clearAllocation", () => {
  it("unallocate removes a node and its weapon-set entry", () => {
    let b = applyAllocation(build(), "n1", "set1", { toggle: false }).build;
    b = unallocate(b, "n1");
    expect(nodeAllocState(b, "n1")).toBe("unallocated");
    expect(b.passiveWeaponSet["n1"]).toBeUndefined();
  });

  it("clearAllocation empties both allocated and passiveWeaponSet", () => {
    let b = applyAllocation(build(), "n1", "set1", { toggle: false }).build;
    b = applyAllocation(b, "n2", "global", { toggle: false }).build;
    b = clearAllocation(b);
    expect(b.allocated).toHaveLength(0);
    expect(Object.keys(b.passiveWeaponSet)).toHaveLength(0);
  });
});

describe("allocatedEdgeRole", () => {
  const alloc = new Set(["a", "b", "c", "d"]);

  it("classifies global-only edges", () => {
    expect(allocatedEdgeRole("a", "b", alloc, {})).toBe("global");
  });

  it("classifies pure set I and set II edges", () => {
    expect(allocatedEdgeRole("a", "b", alloc, { a: 1, b: 1 })).toBe(1);
    expect(allocatedEdgeRole("c", "d", alloc, { c: 2, d: 2 })).toBe(2);
  });

  it("classifies global↔set connectors under that set", () => {
    expect(allocatedEdgeRole("a", "b", alloc, { b: 1 })).toBe(1);
    expect(allocatedEdgeRole("c", "d", alloc, { c: 2 })).toBe(2);
  });

  it("returns null for set I↔set II bridges", () => {
    expect(allocatedEdgeRole("a", "b", alloc, { a: 1, b: 2 })).toBeNull();
  });
});
