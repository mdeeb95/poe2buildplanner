import { z } from "zod";

export const TreeArtAtlasSchema = z.object({
  file: z.string(),
  cellW: z.number().int().positive(),
  cellH: z.number().int().positive(),
  cols: z.number().int().positive(),
  count: z.number().int().nonnegative(),
});

export const TreeArtIconRefSchema = z.object({
  atlas: z.string(),
  index: z.number().int().positive(),
});

export const TreeArtFrameRefSchema = z.object({
  file: z.string(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

export const TreeArtNodeOverlaySchema = z.object({
  alloc: z.string(),
  path: z.string(),
  unalloc: z.string(),
});

export const TreeArtManifestSchema = z.object({
  version: z.object({
    pobCommit: z.string(),
    treeVersion: z.string(),
    fetchedAt: z.string(),
  }),
  atlases: z.record(z.string(), TreeArtAtlasSchema),
  icons: z.record(z.string(), TreeArtIconRefSchema),
  frames: z.record(z.string(), TreeArtFrameRefSchema),
  nodeOverlay: z.record(z.string(), TreeArtNodeOverlaySchema),
});

export type TreeArtManifest = z.infer<typeof TreeArtManifestSchema>;
