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

function commonPrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/**
 * True if `word` and `token` look like inflections of the same stem, e.g.
 * "parry" / "parried" / "parries" / "parrying", so searching "parry" finds a
 * "Parried" node. Both must already be lowercase.
 *
 * Conservative on purpose: requires a 4+ char shared prefix with only short
 * (≤3 char) trailing differences, which covers English inflectional endings
 * (-s, -ed, -ied, -ies, -ing, -y) without lighting up unrelated words.
 */
function stemMatch(word: string, token: string): boolean {
  if (token.length < 4) return false;
  const cp = commonPrefixLen(word, token);
  if (cp < 4) return false;
  return word.length - cp <= 3 && token.length - cp <= 3;
}

/**
 * Multi-token fuzzy match: each whitespace-separated token must match the
 * haystack, either as an in-order subsequence (e.g. "eleme arma" matches
 * "Elemental Armament") or as an inflection of one of its words (so "parry"
 * matches "Parried").
 */
export function fuzzyMatch(haystack: string, query: string): boolean {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const lower = haystack.toLowerCase();
  let words: string[] | null = null;
  return tokens.every((token) => {
    if (subsequenceMatch(lower, token)) return true;
    const t = token.toLowerCase();
    if (words === null) words = lower.split(/[^a-z0-9]+/).filter(Boolean);
    return words.some((w) => stemMatch(w, t));
  });
}

export function fuzzyMatchAny(haystacks: string[], query: string): boolean {
  return haystacks.some((h) => fuzzyMatch(h, query));
}
