import type { GemStatValues } from "@/schemas/gem-stat-block";
import type { StatDescriptionEntry, StatDescriptionLimit } from "@/schemas/stat-description";

/** Pruned stat-description lookup keyed by stat id (see gem-stat-blocks.json). */
export type StatDescriptions = Record<string, StatDescriptionEntry>;

/**
 * Render a gem's blue in-game stat lines at a given gem level. Mirrors the slice
 * of Path of Building's stat describer we need: resolve each stat's value, pick
 * the description line whose `limit` ranges contain it, apply value transforms,
 * and substitute `{0}`/`{1}` placeholders. Stats with no description (display-
 * only flags, behaviours we don't model) are skipped.
 */
export function renderStatLines(
  block: GemStatValues,
  gemLevel: number,
  descriptions: StatDescriptions,
): string[] {
  const valueOf = new Map<string, number>();
  const order: string[] = [];
  const note = (id: string, v: number) => {
    if (!valueOf.has(id)) order.push(id);
    valueOf.set(id, v);
  };

  for (const [id, v] of block.constant) note(id, v);
  if (block.dynamic) {
    const values = pickLevelValues(block.dynamic.byLevel, gemLevel);
    // Stats listed without a per-level value are presence flags (PoB defaults
    // them to 1), e.g. "can_perform_skill_while_moving".
    block.dynamic.statIds.forEach((id, i) => note(id, values[i] ?? 1));
  }

  const lines: string[] = [];
  const consumed = new Set<string>();
  for (const id of order) {
    if (consumed.has(id)) continue;
    const entry = descriptions[id];
    if (!entry) {
      consumed.add(id);
      continue;
    }
    // Multi-stat entries (e.g. min/max pairs) read all their stats at once.
    const values = entry.stats.map((s) => valueOf.get(s) ?? 0);
    for (const s of entry.stats) consumed.add(s);
    const text = renderEntry(entry, values);
    if (text) lines.push(text);
  }
  return lines;
}

/**
 * Map a character level to the gem level a build reaches: the highest gem level
 * whose `levelRequirement` is met, capped at the gem's natural max. Used to pick
 * which per-level stat values the tooltip shows.
 */
export function resolveGemLevel(
  levels: ReadonlyArray<{ level: number; levelRequirement: number }>,
  characterLevel: number,
  naturalMaxLevel: number | null,
): number {
  let best = 1;
  for (const l of levels) {
    if (l.levelRequirement <= characterLevel && l.level > best) best = l.level;
  }
  if (naturalMaxLevel != null) best = Math.min(best, naturalMaxLevel);
  return best;
}

/** Exact level if present, else the nearest defined level at or below it. */
function pickLevelValues(byLevel: Record<string, number[]>, level: number): number[] {
  const exact = byLevel[String(level)];
  if (exact) return exact;
  const keys = Object.keys(byLevel)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (keys.length === 0) return [];
  let best = keys[0]!;
  for (const k of keys) if (k <= level) best = k;
  return byLevel[String(best)] ?? [];
}

function renderEntry(entry: StatDescriptionEntry, values: number[]): string | null {
  for (const line of entry.lines) {
    if (!limitMatches(line.limit, values)) continue;
    const out = values.slice();
    for (const t of line.transforms ?? []) {
      if (t.index < out.length) out[t.index] = applyTransform(t.op, out[t.index]!);
    }
    return substitute(line.text, out);
  }
  return null;
}

/** Each limit entry constrains the value at the same index; `"#"` = open bound. */
function limitMatches(limit: StatDescriptionLimit[] | null, values: number[]): boolean {
  if (!limit) return true;
  for (let i = 0; i < limit.length; i++) {
    const v = values[i];
    if (v === undefined) continue;
    const { min, max } = limit[i]!;
    if (typeof min === "number" && v < min) return false;
    if (typeof max === "number" && v > max) return false;
  }
  return true;
}

/** Port of PoB's common value handlers; unknown ops pass the value through. */
function applyTransform(op: string, v: number): number {
  switch (op) {
    case "negate":
      return -v;
    case "divide_by_one_hundred":
    case "divide_by_one_hundred_2dp":
    case "divide_by_one_hundred_2dp_if_required":
      return v / 100;
    case "milliseconds_to_seconds":
    case "milliseconds_to_seconds_0dp":
    case "milliseconds_to_seconds_1dp":
    case "milliseconds_to_seconds_2dp":
      return v / 1000;
    case "deciseconds_to_seconds":
    case "divide_by_ten_0dp":
    case "divide_by_ten_1dp":
      return v / 10;
    case "divide_by_two_0dp":
      return v / 2;
    case "divide_by_five":
      return v / 5;
    case "divide_by_fifteen_0dp":
      return v / 15;
    case "divide_by_one_thousand":
      return v / 1000;
    case "per_minute_to_per_second":
    case "per_minute_to_per_second_0dp":
    case "per_minute_to_per_second_1dp":
    case "per_minute_to_per_second_2dp":
      return v / 60;
    case "times_twenty":
      return v * 20;
    case "times_one_point_five":
      return v * 1.5;
    case "60%_of_value":
      return v * 0.6;
    default:
      return v;
  }
}

/** Substitute `{0}`, `{1}`, … (with optional `:+d`-style format hints). */
function substitute(text: string, values: number[]): string {
  return text.replace(/\{(\d+)(?::([^}]+))?\}/g, (_match, idx: string, fmt?: string) => {
    const v = values[Number(idx)];
    if (v === undefined || Number.isNaN(v)) return "";
    const s = formatNumber(v);
    return fmt?.includes("+") && v >= 0 ? `+${s}` : s;
  });
}

function formatNumber(v: number): string {
  return String(Math.round(v * 100) / 100);
}
