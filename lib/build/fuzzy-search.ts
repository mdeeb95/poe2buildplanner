/** True if every char of `needle` appears in order within `haystack`. */
export function subsequenceMatch(haystack: string, needle: string): boolean {
  if (!needle) return true;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  let i = 0;
  for (let j = 0; j < h.length && i < n.length; j++) {
    if (h[j] === n[i]) i++;
  }
  return i === n.length;
}

/**
 * Multi-token fuzzy match: each whitespace-separated token must subsequence-match
 * the haystack. e.g. "eleme arma" matches "Elemental Armament".
 */
export function fuzzyMatch(haystack: string, query: string): boolean {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => subsequenceMatch(haystack, token));
}

export function fuzzyMatchAny(haystacks: string[], query: string): boolean {
  return haystacks.some((h) => fuzzyMatch(h, query));
}
