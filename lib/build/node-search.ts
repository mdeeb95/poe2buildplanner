import { fuzzyMatchAny } from "./fuzzy-search";
import type { Tree } from "@/schemas/tree";

export const SEARCH_MIN_CHARS = 2;

/**
 * Node ids whose name or any stat line fuzzy-matches `query`. Requires at least
 * SEARCH_MIN_CHARS so a single keystroke doesn't light up the whole tree.
 * Includes ascendancy nodes; skips un-positioned (group === null) nodes.
 */
export function searchNodes(tree: Tree, query: string): Set<string> {
  const out = new Set<string>();
  const q = query.trim();
  if (q.length < SEARCH_MIN_CHARS) return out;
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.group === null) continue;
    const haystacks: string[] = [];
    if (node.name) haystacks.push(node.name);
    for (const s of node.stats) haystacks.push(s);
    if (haystacks.length === 0) continue;
    if (fuzzyMatchAny(haystacks, q)) out.add(id);
  }
  return out;
}
