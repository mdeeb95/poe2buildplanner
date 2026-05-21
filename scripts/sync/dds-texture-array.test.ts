import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decompress } from "fzstd";
import { createUpstream } from "./fetch.js";
import { decodeDdsSlice, parseDdsTextureArray, sliceStrideFor } from "./dds-texture-array.js";

describe("dds texture array", () => {
  it("skills_64 slice stride includes mip chain", () => {
    expect(sliceStrideFor(64, 64, "bc1")).toBe(2744);
  });

  it("parses skills_64 file size from upstream cache", async () => {
    const upstream = createUpstream();
    const zst = await upstream.fetchFile("src/TreeData/0_4/skills_64_64_BC1.dds.zst");
    const dds = Buffer.from(decompress(new Uint8Array(zst)));
    const meta = parseDdsTextureArray(dds);
    expect(meta.arraySize).toBe(165);
    expect(meta.sliceStride).toBe(2744);
    expect(meta.width).toBe(64);
    expect(meta.height).toBe(64);

    const tree = JSON.parse(
      readFileSync(upstream.cachePath("src/TreeData/0_4/tree.json"), "utf8"),
    ) as { ddsCoords: Record<string, Record<string, number>> };
    const icon = "Art/2DArt/SkillIcons/passives/LightningDamagenode.dds";
    const idx = tree.ddsCoords["skills_64_64_BC1.dds.zst"][icon];
    const rgba = decodeDdsSlice(dds, meta, idx);
    expect(rgba.length).toBe(64 * 64 * 4);
    // non-trivial icon (not all transparent)
    let nonZero = 0;
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] > 0) nonZero++;
    }
    expect(nonZero).toBeGreaterThan(100);
  });
});
