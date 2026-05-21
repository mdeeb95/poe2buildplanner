import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { EdgeRecord } from "@/lib/tree/build-edge-index";
import { TreeEdgesActive } from "./TreeEdgesActive";

const E: EdgeRecord[] = [
  { fragment: "M0 0L10 0", a: "1", b: "2" },
  { fragment: "M10 0L20 0", a: "2", b: "3" },
  { fragment: "M20 0L30 0", a: "3", b: "4" },
];

describe("TreeEdgesActive", () => {
  it("renders nothing when allocatedIds is empty", () => {
    const out = renderToStaticMarkup(
      <TreeEdgesActive
        edgeIndex={E}
        allocatedIds={new Set()}
        passiveWeaponSet={{}}
      />,
    );
    expect(out).toBe("");
  });

  it("includes only edges whose BOTH endpoints are allocated", () => {
    const out = renderToStaticMarkup(
      <TreeEdgesActive
        edgeIndex={E}
        allocatedIds={new Set(["1", "2", "3"])}
        passiveWeaponSet={{}}
      />,
    );
    expect(out).toContain("M0 0L10 0");
    expect(out).toContain("M10 0L20 0");
    expect(out).not.toContain("M20 0L30 0");
  });

  it("colors set I edges red and set II edges green", () => {
    const out = renderToStaticMarkup(
      <TreeEdgesActive
        edgeIndex={E}
        allocatedIds={new Set(["1", "2", "3", "4"])}
        passiveWeaponSet={{ "1": 1, "2": 1, "3": 2, "4": 2 }}
      />,
    );
    expect(out).toContain("var(--color-weapon-set-1)");
    expect(out).toContain("var(--color-weapon-set-2)");
    expect(out).toContain("M0 0L10 0");
    expect(out).toContain("M20 0L30 0");
    expect(out).not.toContain("var(--color-node-class-start)");
  });

  it("renders global-only edges in white", () => {
    const out = renderToStaticMarkup(
      <TreeEdgesActive
        edgeIndex={[{ fragment: "M0 0L10 0", a: "1", b: "2" }]}
        allocatedIds={new Set(["1", "2"])}
        passiveWeaponSet={{}}
      />,
    );
    expect(out).toContain("var(--color-node-class-start)");
    expect(out).not.toContain("var(--color-weapon-set-1)");
  });
});
