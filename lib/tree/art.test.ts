import { describe, expect, it } from "vitest";
import { iconSprite } from "./art";
import type { TreeArtManifest } from "@/schemas/tree-art";

const manifest: TreeArtManifest = {
  version: { pobCommit: "x", treeVersion: "0_4", fetchedAt: "2026-01-01T00:00:00.000Z" },
  atlases: {
    skills_64: { file: "/tree/skills-64.webp", cellW: 64, cellH: 64, cols: 16, count: 165 },
  },
  icons: {
    "Art/2DArt/SkillIcons/passives/LightningDamagenode.dds": { atlas: "skills_64", index: 64 },
  },
  frames: {},
  nodeOverlay: {},
};

describe("iconSprite", () => {
  it("maps 1-based atlas index to grid cell", () => {
    const s = iconSprite("Art/2DArt/SkillIcons/passives/LightningDamagenode.dds", manifest);
    expect(s).toEqual({
      href: "/tree/skills-64.webp",
      x: 960,
      y: 192,
      w: 64,
      h: 64,
      atlasW: 1024,
      atlasH: 704,
    });
  });
});
