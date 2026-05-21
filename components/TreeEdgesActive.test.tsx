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
      <TreeEdgesActive edgeIndex={E} allocatedIds={new Set()} />,
    );
    expect(out).toBe("");
  });

  it("includes only edges whose BOTH endpoints are in allocatedIds", () => {
    const out = renderToStaticMarkup(
      <TreeEdgesActive edgeIndex={E} allocatedIds={new Set(["1", "2", "3"])} />,
    );
    // edge 1↔2 and 2↔3 should appear; edge 3↔4 should not (4 not allocated).
    expect(out).toContain("M0 0L10 0");
    expect(out).toContain("M10 0L20 0");
    expect(out).not.toContain("M20 0L30 0");
  });

  it("renders an empty path (no element) when no edges qualify", () => {
    const out = renderToStaticMarkup(
      <TreeEdgesActive edgeIndex={E} allocatedIds={new Set(["1", "4"])} />,
    );
    // No edge has both endpoints allocated.
    expect(out).toBe("");
  });
});
