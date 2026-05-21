/** Parse PoB `src/Data/Uniques/*.lua` long-string blocks. */

export interface ParsedUnique {
  name: string;
  base: string;
  slot: string;
}

export function parseUniquesLua(source: string, slot: string): ParsedUnique[] {
  const results: ParsedUnique[] = [];
  const re = /\[\[\s*([\s\S]*?)\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(source)) !== null) {
    const lines = match[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("--"));

    if (lines.length < 2) continue;

    const name = lines[0]!;
    const base = lines[1]!;

    results.push({ name, base, slot });
  }

  return results;
}
