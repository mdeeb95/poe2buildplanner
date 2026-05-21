import { describe, expect, it } from "vitest";
import { createEmptyBuild } from "./defaults";
import {
  applyPassiveLevels,
  applyPassiveLevelsStep,
  levelForNewWeaponSetNode,
  levelForWeaponSetSlot,
  maxAllocatedLevel,
  maxGlobalLevel,
  newlyAllocatedIds,
  parallelWeaponSetLevel,
  weaponSetNodesInOrder,
  weaponSetOriginLevel,
} from "./passive-levels";
import type { BuildState } from "@/schemas/build";

function globals(n: number): { ids: string[]; levels: Record<string, number> } {
  const ids = Array.from({ length: n }, (_, i) => `g${i}`);
  return { ids, levels: Object.fromEntries(ids.map((id, i) => [id, i + 1])) };
}

function buildWithGlobals(n: number): BuildState {
  const { ids, levels } = globals(n);
  return { ...createEmptyBuild(), allocated: ids, nodeLevels: levels };
}

describe("newlyAllocatedIds", () => {
  it("returns ids in next order", () => {
    expect(newlyAllocatedIds(["a"], ["a", "b", "c"])).toEqual(["b", "c"]);
  });
});

describe("maxAllocatedLevel", () => {
  it("returns 0 when no levels stored", () => {
    expect(maxAllocatedLevel({}, ["a", "b"])).toBe(0);
  });

  it("returns highest among allocated", () => {
    expect(maxAllocatedLevel({ a: 3, b: 7, c: 2 }, ["a", "b"])).toBe(7);
  });
});

describe("maxGlobalLevel", () => {
  it("ignores weapon-set nodes", () => {
    expect(
      maxGlobalLevel({ g: 10, s1: 11, s2: 11 }, ["g", "s1", "s2"], { s1: 1, s2: 2 }),
    ).toBe(10);
  });
});

describe("weaponSetNodesInOrder", () => {
  it("preserves allocation order within a set", () => {
    expect(
      weaponSetNodesInOrder(["g", "s2b", "s2a"], { s2a: 2, s2b: 2 }, 2),
    ).toEqual(["s2b", "s2a"]);
  });
});

describe("weaponSetOriginLevel", () => {
  it("returns 0 when no weapon-set nodes exist", () => {
    expect(weaponSetOriginLevel({ g: 5 }, ["g"], {})).toBe(0);
  });

  it("derives origin from existing weapon-set levels", () => {
    expect(
      weaponSetOriginLevel(
        { g: 14, s2a: 11, s2b: 12 },
        ["g", "s2a", "s2b"],
        { s2a: 2, s2b: 2 },
      ),
    ).toBe(10);
  });

  it("uses the minimum implied origin across both sets", () => {
    expect(
      weaponSetOriginLevel(
        { s1a: 15, s2a: 11 },
        ["s1a", "s2a"],
        { s1a: 1, s2a: 2 },
      ),
    ).toBe(10);
  });
});

describe("parallelWeaponSetLevel", () => {
  it("returns the opposite set level at the same slot", () => {
    expect(
      parallelWeaponSetLevel(
        { s2a: 11, s2b: 12 },
        ["s2a", "s2b"],
        { s2a: 2, s2b: 2 },
        1,
        1,
      ),
    ).toBe(11);
    expect(
      parallelWeaponSetLevel(
        { s2a: 11, s2b: 12 },
        ["s2a", "s2b"],
        { s2a: 2, s2b: 2 },
        1,
        2,
      ),
    ).toBe(12);
  });

  it("returns null when parallel slot is empty", () => {
    expect(
      parallelWeaponSetLevel({ s2a: 11 }, ["s2a"], { s2a: 2 }, 1, 2),
    ).toBeNull();
  });
});

describe("levelForWeaponSetSlot", () => {
  const baseline = 10;

  it("matches parallel set before using origin", () => {
    expect(
      levelForWeaponSetSlot(
        { g: 14, s2a: 11, s2b: 12 },
        ["g", "s2a", "s2b"],
        { s2a: 2, s2b: 2 },
        1,
        1,
        baseline,
      ),
    ).toBe(11);
  });

  it("extends past parallel slots with locked origin", () => {
    expect(
      levelForWeaponSetSlot(
        { g: 20, s2a: 11, s2b: 12 },
        ["g", "s2a", "s2b"],
        { s2a: 2, s2b: 2 },
        1,
        3,
        baseline,
      ),
    ).toBe(13);
  });

  it("starts from global baseline when no weapon-set nodes exist yet", () => {
    expect(
      levelForWeaponSetSlot({ g: 10 }, ["g"], {}, 2, 1, baseline),
    ).toBe(11);
  });
});

describe("levelForNewWeaponSetNode", () => {
  it("fills lowest empty slot that has a parallel level", () => {
    expect(
      levelForNewWeaponSetNode(
        { s2b: 12, s1a: 11 },
        ["s2b", "s1a"],
        { s2b: 2, s1a: 1 },
        2,
        10,
      ),
    ).toBe(11);
  });
});

describe("applyPassiveLevels — globals", () => {
  it("assigns L1 to first allocation", () => {
    const prev = createEmptyBuild();
    const next = { ...prev, allocated: ["n1"] };
    expect(applyPassiveLevels(prev, next).nodeLevels).toEqual({ n1: 1 });
  });

  it("assigns consecutive levels on batch add", () => {
    const prev = { ...createEmptyBuild(), allocated: ["a"], nodeLevels: { a: 1 } };
    const next = { ...prev, allocated: ["a", "b", "c"] };
    expect(applyPassiveLevels(prev, next).nodeLevels).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("uses max+1 after dealloc without renumbering survivors", () => {
    const prev = {
      ...createEmptyBuild(),
      allocated: ["a", "b"],
      nodeLevels: { a: 1, b: 2 },
    };
    const pruned = applyPassiveLevels(prev, { ...prev, allocated: ["a"] });
    expect(pruned.nodeLevels).toEqual({ a: 1 });

    const readd = { ...pruned, allocated: ["a", "c"] };
    expect(applyPassiveLevels(pruned, readd).nodeLevels).toEqual({ a: 1, c: 2 });
  });

  it("global passives after weapon sets continue from overall max", () => {
    const prev = {
      ...createEmptyBuild(),
      allocated: ["g1", "g2", "s1", "s2"],
      nodeLevels: { g1: 1, g2: 2, s1: 3, s2: 3 },
      passiveWeaponSet: { s1: 1 as const, s2: 2 as const },
    };
    const next = { ...prev, allocated: [...prev.allocated, "g3"] };
    expect(applyPassiveLevels(prev, next).nodeLevels.g3).toBe(4);
  });
});

describe("applyPassiveLevels — weapon-set reassignment", () => {
  it("does not change levels when only weapon set changes", () => {
    const prev = {
      ...createEmptyBuild(),
      allocated: ["a"],
      nodeLevels: { a: 22 },
      passiveWeaponSet: {},
    };
    const next = { ...prev, passiveWeaponSet: { a: 1 as const } };
    expect(applyPassiveLevels(prev, next).nodeLevels).toEqual({ a: 22 });
  });
});

describe("applyPassiveLevels — parallel weapon-set tracks", () => {
  it("set 1 then set 2 share slot levels", () => {
    let build = buildWithGlobals(10);

    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s1a"],
      passiveWeaponSet: { s1a: 1 },
    });
    expect(build.nodeLevels.s1a).toBe(11);

    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s1b"],
      passiveWeaponSet: { ...build.passiveWeaponSet, s1b: 1 },
    });
    expect(build.nodeLevels.s1b).toBe(12);

    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s2a"],
      passiveWeaponSet: { ...build.passiveWeaponSet, s2a: 2 },
    });
    expect(build.nodeLevels.s2a).toBe(11);

    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s2b"],
      passiveWeaponSet: { ...build.passiveWeaponSet, s2b: 2 },
    });
    expect(build.nodeLevels.s2b).toBe(12);
  });

  it("set 2 then set 1 share slot levels", () => {
    let build = buildWithGlobals(10);

    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s2a"],
      passiveWeaponSet: { s2a: 2 },
    });
    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s2b"],
      passiveWeaponSet: { ...build.passiveWeaponSet, s2b: 2 },
    });
    expect(build.nodeLevels.s2a).toBe(11);
    expect(build.nodeLevels.s2b).toBe(12);

    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s1a"],
      passiveWeaponSet: { ...build.passiveWeaponSet, s1a: 1 },
    });
    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s1b"],
      passiveWeaponSet: { ...build.passiveWeaponSet, s1b: 1 },
    });
    expect(build.nodeLevels.s1a).toBe(11);
    expect(build.nodeLevels.s1b).toBe(12);
  });

  it("REGRESSION: set 2 first, extra globals, then set 1 still matches set 2 slots", () => {
    let build = buildWithGlobals(10);

    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s2a", "s2b"],
      passiveWeaponSet: { s2a: 2, s2b: 2 },
    });
    expect(build.nodeLevels.s2a).toBe(11);
    expect(build.nodeLevels.s2b).toBe(12);

    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "g10", "g11"],
    });
    expect(build.nodeLevels.g10).toBe(13);
    expect(build.nodeLevels.g11).toBe(14);

    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s1a", "s1b"],
      passiveWeaponSet: { ...build.passiveWeaponSet, s1a: 1, s1b: 1 },
    });
    expect(build.nodeLevels.s1a).toBe(11);
    expect(build.nodeLevels.s1b).toBe(12);
    expect(build.nodeLevels.s2a).toBe(11);
    expect(build.nodeLevels.s2b).toBe(12);
  });

  it("REGRESSION: batch add set 2 then globals then batch add set 1", () => {
    let build = buildWithGlobals(10);

    build = applyPassiveLevels(build, {
      ...build,
      allocated: [...build.allocated, "s2a", "s2b"],
      passiveWeaponSet: { s2a: 2, s2b: 2 },
    });
    expect(build.nodeLevels.s2a).toBe(11);
    expect(build.nodeLevels.s2b).toBe(12);

    build = applyPassiveLevels(build, {
      ...build,
      allocated: [...build.allocated, "g10", "g11"],
    });
    expect(build.nodeLevels.g10).toBe(13);
    expect(build.nodeLevels.g11).toBe(14);

    build = applyPassiveLevels(build, {
      ...build,
      allocated: [...build.allocated, "s1a", "s1b"],
      passiveWeaponSet: { ...build.passiveWeaponSet, s1a: 1, s1b: 1 },
    });
    expect(build.nodeLevels.s1a).toBe(11);
    expect(build.nodeLevels.s1b).toBe(12);
  });

  it("alternating set picks still pair by slot index", () => {
    let build = buildWithGlobals(8);

    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s2a"],
      passiveWeaponSet: { s2a: 2 },
    });
    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s1a"],
      passiveWeaponSet: { ...build.passiveWeaponSet, s1a: 1 },
    });
    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s2b"],
      passiveWeaponSet: { ...build.passiveWeaponSet, s2b: 2 },
    });
    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s1b"],
      passiveWeaponSet: { ...build.passiveWeaponSet, s1b: 1 },
    });

    expect(build.nodeLevels.s2a).toBe(9);
    expect(build.nodeLevels.s1a).toBe(9);
    expect(build.nodeLevels.s2b).toBe(10);
    expect(build.nodeLevels.s1b).toBe(10);
  });

  it("globals interleaved between weapon-set picks do not shift origin", () => {
    let build = buildWithGlobals(8);

    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s2a"],
      passiveWeaponSet: { s2a: 2 },
    });
    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "g8"],
    });
    expect(build.nodeLevels.g8).toBe(10);

    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s2b"],
      passiveWeaponSet: { ...build.passiveWeaponSet, s2b: 2 },
    });
    expect(build.nodeLevels.s2a).toBe(9);
    expect(build.nodeLevels.s2b).toBe(10);

    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s1a"],
      passiveWeaponSet: { ...build.passiveWeaponSet, s1a: 1 },
    });
    expect(build.nodeLevels.s1a).toBe(9);
  });

  it("third slot extends from locked origin when parallel slot missing", () => {
    let build = buildWithGlobals(10);

    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s2a", "s2b"],
      passiveWeaponSet: { s2a: 2, s2b: 2 },
    });
    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "g10", "g11"],
    });

    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s1a", "s1b", "s1c"],
      passiveWeaponSet: { ...build.passiveWeaponSet, s1a: 1, s1b: 1, s1c: 1 },
    });
    expect(build.nodeLevels.s1a).toBe(11);
    expect(build.nodeLevels.s1b).toBe(12);
    expect(build.nodeLevels.s1c).toBe(13);

    build = applyPassiveLevelsStep(build, {
      allocated: [...build.allocated, "s2c"],
      passiveWeaponSet: { ...build.passiveWeaponSet, s2c: 2 },
    });
    expect(build.nodeLevels.s2c).toBe(13);
  });

  it("weapon-set-only build starts both sets at L1/L2", () => {
    let build = createEmptyBuild();

    build = applyPassiveLevelsStep(build, {
      allocated: ["s2a"],
      passiveWeaponSet: { s2a: 2 },
    });
    expect(build.nodeLevels.s2a).toBe(1);

    build = applyPassiveLevelsStep(build, {
      allocated: ["s2a", "s1a"],
      passiveWeaponSet: { s2a: 2, s1a: 1 },
    });
    expect(build.nodeLevels.s1a).toBe(1);
  });

  it("batch path: globals then weapon-set nodes in one action", () => {
    const prev = buildWithGlobals(10);
    const next = {
      ...prev,
      allocated: [...prev.allocated, "g10", "g11", "s1a", "s1b"],
      passiveWeaponSet: { s1a: 1, s1b: 1 },
    };
    const out = applyPassiveLevels(prev, next);
    expect(out.nodeLevels.g10).toBe(11);
    expect(out.nodeLevels.g11).toBe(12);
    expect(out.nodeLevels.s1a).toBe(11);
    expect(out.nodeLevels.s1b).toBe(12);
  });

  it("batch path after set 2 exists: new set 1 batch matches parallel slots", () => {
    const prev = {
      ...buildWithGlobals(10),
      allocated: [...globals(10).ids, "g10", "g11", "s2a", "s2b"],
      nodeLevels: {
        ...globals(10).levels,
        g10: 13,
        g11: 14,
        s2a: 11,
        s2b: 12,
      },
      passiveWeaponSet: { s2a: 2, s2b: 2 },
    };
    const next = {
      ...prev,
      allocated: [...prev.allocated, "s1a", "s1b"],
      passiveWeaponSet: { ...prev.passiveWeaponSet, s1a: 1, s1b: 1 },
    };
    const out = applyPassiveLevels(prev, next);
    expect(out.nodeLevels.s1a).toBe(11);
    expect(out.nodeLevels.s1b).toBe(12);
  });

  it("deallocating weapon-set node does not renumber survivors", () => {
    let build = buildWithGlobals(10);
    build = applyPassiveLevels(build, {
      ...build,
      allocated: [...build.allocated, "s2a", "s2b", "s1a"],
      passiveWeaponSet: { s2a: 2, s2b: 2, s1a: 1 },
    });

    const next = {
      ...build,
      allocated: build.allocated.filter((id) => id !== "s2a"),
      passiveWeaponSet: { s2b: 2 as const, s1a: 1 as const },
    };
    const out = applyPassiveLevels(build, next);
    expect(out.nodeLevels.s2b).toBe(12);
    expect(out.nodeLevels.s1a).toBe(11);
    expect(out.nodeLevels.s2a).toBeUndefined();
  });

  it("re-adding a weapon-set node fills the matching parallel slot level", () => {
    let build = buildWithGlobals(10);
    build = applyPassiveLevels(build, {
      ...build,
      allocated: [...build.allocated, "s2a", "s2b", "s1a"],
      passiveWeaponSet: { s2a: 2, s2b: 2, s1a: 1 },
    });

    build = applyPassiveLevels(build, {
      ...build,
      allocated: build.allocated.filter((id) => id !== "s2a"),
      passiveWeaponSet: { s2b: 2, s1a: 1 },
    });

    build = applyPassiveLevels(build, {
      ...build,
      allocated: [...build.allocated, "s2a"],
      passiveWeaponSet: { ...build.passiveWeaponSet, s2a: 2 },
    });
    expect(build.nodeLevels.s2a).toBe(11);
  });
});
