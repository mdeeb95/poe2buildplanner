import { parseAssignmentTable, readLuaSource } from "../parse/lua.js";
import {
  BasesFileSchema,
  type BaseItem,
  type BasesFile,
} from "@/schemas/base.js";
import type { Upstream } from "./fetch.js";

const BASES_DIR = "src/Data/Bases";

type LuaRecord = Record<string, unknown>;

interface UpstreamBase {
  type?: string;
  subType?: string;
  quality?: number;
  socketLimit?: number;
  tags?: Record<string, boolean>;
  implicit?: string;
  implicitModTypes?: unknown;
  weapon?: LuaRecord | unknown[];
  armour?: LuaRecord | unknown[];
  req?: LuaRecord | unknown[];
  requirements?: LuaRecord | unknown[];
}

export async function syncBases(upstream: Upstream): Promise<BasesFile> {
  const fileNames = await upstream.listDir(BASES_DIR);
  const luaFiles = fileNames.filter((n) => n.endsWith(".lua"));

  const bases: Record<string, BaseItem> = {};
  const bySlot: Record<string, string[]> = {};

  for (const file of luaFiles) {
    const slot = file.replace(/\.lua$/, "");
    const src = readLuaSource(await upstream.fetchFile(`${BASES_DIR}/${file}`));
    const { data } = parseAssignmentTable(src, {
      expectedBaseNames: ["itemBases", "bases"],
    });

    for (const [name, rawValue] of Object.entries(data)) {
      const raw = rawValue as UpstreamBase;
      const item = buildBaseItem(name, slot, raw);
      bases[name] = item;
      (bySlot[slot] ??= []).push(name);
    }
  }

  for (const list of Object.values(bySlot)) list.sort();

  const result: BasesFile = {
    version: { pobCommit: upstream.sha, fetchedAt: new Date().toISOString() },
    bases,
    bySlot,
  };
  return BasesFileSchema.parse(result);
}

function buildBaseItem(name: string, slot: string, raw: UpstreamBase): BaseItem {
  const reqRaw = raw.req ?? raw.requirements;
  const requirements = asPlainObject(reqRaw);

  return {
    id: name,
    name,
    slot,
    type: raw.type ?? slot,
    subType: raw.subType ?? null,
    tags: raw.tags ?? {},
    implicit: raw.implicit ?? null,
    quality: typeof raw.quality === "number" ? raw.quality : null,
    socketLimit: typeof raw.socketLimit === "number" ? raw.socketLimit : null,
    requirements: {
      level: numOrUndef(requirements.level),
      str: numOrUndef(requirements.str),
      dex: numOrUndef(requirements.dex),
      int: numOrUndef(requirements.int),
    },
    weapon: pickWeapon(asPlainObject(raw.weapon)),
    armour: pickArmour(asPlainObject(raw.armour)),
  };
}

function asPlainObject(v: unknown): LuaRecord {
  if (!v) return {};
  if (Array.isArray(v)) return {};
  if (typeof v === "object") return v as LuaRecord;
  return {};
}

function numOrUndef(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function pickWeapon(raw: LuaRecord): BaseItem["weapon"] {
  if (Object.keys(raw).length === 0) return null;
  return {
    physicalMin: numOrUndef(raw.PhysicalMin ?? raw.physicalMin),
    physicalMax: numOrUndef(raw.PhysicalMax ?? raw.physicalMax),
    critChanceBase: numOrUndef(raw.CritChanceBase ?? raw.critChanceBase),
    attackRateBase: numOrUndef(raw.AttackRateBase ?? raw.attackRateBase),
    range: numOrUndef(raw.Range ?? raw.range),
  };
}

function pickArmour(raw: LuaRecord): BaseItem["armour"] {
  if (Object.keys(raw).length === 0) return null;
  return {
    armour: numOrUndef(raw.Armour ?? raw.armour),
    evasion: numOrUndef(raw.Evasion ?? raw.evasion),
    energyShield: numOrUndef(raw.EnergyShield ?? raw.energyShield),
    movementPenalty: numOrUndef(raw.MovementPenalty ?? raw.movementPenalty),
    ward: numOrUndef(raw.Ward ?? raw.ward),
  };
}
