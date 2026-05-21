import { parseReturnTable, readLuaSource } from "../parse/lua.js";
import {
  StatDescriptionsFileSchema,
  type StatDescriptionEntry,
  type StatDescriptionLimit,
  type StatDescriptionLine,
  type StatDescriptionsFile,
} from "@/schemas/stat-description.js";
import type { Upstream } from "./fetch.js";

const STAT_DESC_DIR = "src/Data/StatDescriptions";

export async function syncStatDescriptions(upstream: Upstream): Promise<StatDescriptionsFile> {
  const fileNames = await upstream.listDir(STAT_DESC_DIR);
  const luaFiles = fileNames.filter((n) => n.endsWith(".lua"));

  const entries: StatDescriptionEntry[] = [];
  for (const file of luaFiles) {
    const src = readLuaSource(await upstream.fetchFile(`${STAT_DESC_DIR}/${file}`));
    const { data } = parseReturnTable(src);
    for (const rawEntry of orderedValues(data)) {
      const entry = normalizeEntry(rawEntry);
      if (entry) entries.push(entry);
    }
  }

  const byStat: Record<string, number> = {};
  for (let i = 0; i < entries.length; i++) {
    for (const statKey of entries[i]!.stats) {
      byStat[statKey] = i;
    }
  }

  const result: StatDescriptionsFile = {
    version: { pobCommit: upstream.sha, fetchedAt: new Date().toISOString() },
    entries,
    byStat,
  };
  return StatDescriptionsFileSchema.parse(result);
}

function orderedValues(obj: Record<string, unknown>): unknown[] {
  return Object.keys(obj)
    .map((k) => ({ k, n: Number(k) }))
    .filter(({ n }) => Number.isFinite(n))
    .sort((a, b) => a.n - b.n)
    .map(({ k }) => obj[k]);
}

function normalizeEntry(rawValue: unknown): StatDescriptionEntry | null {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) return null;
  const raw = rawValue as Record<string, unknown>;

  const stats = collectStats(raw.stats);
  if (stats.length === 0) return null;

  const lines: StatDescriptionLine[] = [];
  collectLines(raw, lines);

  return { stats, lines };
}

function collectStats(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((s): s is string => typeof s === "string");
  }
  if (typeof value === "object") {
    const out: string[] = [];
    for (const v of orderedValues(value as Record<string, unknown>)) {
      if (typeof v === "string") out.push(v);
    }
    return out;
  }
  return [];
}

function collectLines(node: unknown, out: StatDescriptionLine[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const v of node) collectLines(v, out);
    return;
  }
  const rec = node as Record<string, unknown>;
  if (typeof rec.text === "string") {
    out.push({
      text: rec.text,
      limit: parseLimit(rec.limit),
    });
    return;
  }
  for (const [k, v] of Object.entries(rec)) {
    if (k === "stats" || k === "lang") continue;
    collectLines(v, out);
  }
}

function parseLimit(value: unknown): StatDescriptionLimit[] | null {
  if (!value || typeof value !== "object") return null;
  const arr = Array.isArray(value)
    ? value
    : orderedValues(value as Record<string, unknown>);
  if (arr.length === 0) return null;

  const out: StatDescriptionLimit[] = [];
  for (const pair of arr) {
    if (!pair || typeof pair !== "object") continue;
    const pairArr = Array.isArray(pair)
      ? pair
      : orderedValues(pair as Record<string, unknown>);
    out.push({
      min: normalizeLimitBound(pairArr[0]),
      max: normalizeLimitBound(pairArr[1]),
    });
  }
  return out.length > 0 ? out : null;
}

function normalizeLimitBound(v: unknown): number | string | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") return v;
  return null;
}
