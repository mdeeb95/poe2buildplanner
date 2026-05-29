import { z } from "zod";

/**
 * A skill granted passively by allocating a tree node (almost always an
 * ascendancy notable, e.g. Spirit Walker → "Wild Protector"). Resolved
 * server-side from the tree's `Grants Skill: X` stats, linked to the gem
 * catalog when a matching active gem exists (so support compatibility + colour
 * work) and otherwise synthesised from the node itself.
 */
export const GrantedSkillSchema = z.object({
  /** The granting tree node id (matches entries in `build.allocated`). */
  nodeId: z.string(),
  /** Catalog active-gem id when matched, else `granted:<nodeId>`. */
  skillId: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  color: z.enum(["red", "green", "blue", "white"]),
});

export const GrantedSkillsFileSchema = z.object({
  skills: z.array(GrantedSkillSchema),
});

export type GrantedSkill = z.infer<typeof GrantedSkillSchema>;
export type GrantedSkillsFile = z.infer<typeof GrantedSkillsFileSchema>;
