import { z } from "zod";

export const TreeConstantsSchema = z.object({
  PSSCentreInnerRadius: z.number(),
  orbitRadii: z.array(z.number()),
  skillsPerOrbit: z.array(z.number().int()),
  orbitAnglesByOrbit: z.array(z.array(z.number())),
});

export const TreeBoundsSchema = z.object({
  minX: z.number(),
  maxX: z.number(),
  minY: z.number(),
  maxY: z.number(),
});

export const TreeGroupSchema = z.object({
  x: z.number(),
  y: z.number(),
  orbits: z.array(z.number().int()),
  nodes: z.array(z.string()),
});

export const OutEdgeSchema = z.object({
  id: z.string(),
  orbit: z.number().int().nullable(),
  // Arc centre for orbit-following connectors (from GGG's edge export). Null for
  // straight edges. arcX/arcY are absolute tree coordinates.
  arcX: z.number().nullable().optional(),
  arcY: z.number().nullable().optional(),
});

export const TreeNodeSchema = z.object({
  skill: z.number().int(),
  name: z.string(),
  icon: z.string().nullable(),
  isNotable: z.boolean(),
  isKeystone: z.boolean(),
  isJewelSocket: z.boolean(),
  ascendancyName: z.string().nullable(),
  classesStart: z.array(z.string()).nullable(),
  stats: z.array(z.string()),
  group: z.number().int().nullable(),
  orbit: z.number().int().nullable(),
  orbitIndex: z.number().int().nullable(),
  x: z.number(),
  y: z.number(),
  out: z.array(OutEdgeSchema),
  neighbors: z.array(z.string()),
});

export const TreeAscendancySchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const TreeClassSchema = z.object({
  name: z.string(),
  integerId: z.number().int(),
  baseStr: z.number(),
  baseDex: z.number(),
  baseInt: z.number(),
  ascendancies: z.array(TreeAscendancySchema),
});

export const TreeSchema = z.object({
  version: z.object({
    pobCommit: z.string(),
    treeVersion: z.string(),
    fetchedAt: z.string(),
  }),
  bounds: TreeBoundsSchema,
  constants: TreeConstantsSchema,
  classes: z.array(TreeClassSchema),
  groups: z.array(TreeGroupSchema.nullable()),
  nodes: z.record(z.string(), TreeNodeSchema),
});

export type TreeConstants = z.infer<typeof TreeConstantsSchema>;
export type TreeBounds = z.infer<typeof TreeBoundsSchema>;
export type TreeGroup = z.infer<typeof TreeGroupSchema>;
export type TreeNode = z.infer<typeof TreeNodeSchema>;
export type OutEdge = z.infer<typeof OutEdgeSchema>;
export type TreeAscendancy = z.infer<typeof TreeAscendancySchema>;
export type TreeClass = z.infer<typeof TreeClassSchema>;
export type Tree = z.infer<typeof TreeSchema>;
